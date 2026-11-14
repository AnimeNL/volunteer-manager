// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { setImmediate } from 'node:timers';

import { SetRecordErrorLogDeferDelegate } from '@lib/Log';
import { SmtpClientMock } from '@lib/integrations/smtp/SmtpClientMock';
import { useMockConnection } from '@lib/database/Connection';

import { sendInboxMessage } from './InboxActions';

global.setImmediate = setImmediate;

const mockCreateSmtpClient = vi.fn();
const mockReadSetting = vi.fn();

vi.mock('next/headers', () => ({
    headers: async () => new Headers(),
}));

vi.mock('@lib/auth/AuthenticationContext', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/auth/AuthenticationContext')>();
    const { buildAuthenticationContext: buildContext } =
        await import('@lib/auth/AuthenticationTestHelpers');

    return {
        ...actual,
        getAuthenticationContextFromHeaders: async () => buildContext({
            access: {
                grants: 'event.visible,system.inbox.eligible',
                events: '*',
                teams: '*',
            },
            user: {
                id: 7,
                firstName: 'Peter',
                lastName: 'Beverloo',
                name: 'Peter Beverloo',
                nameOrFirstName: 'Peter',
                username: 'peter@animecon.nl',
            },
        }),
    };
});

vi.mock('@lib/integrations/smtp', () => ({
    createSmtpClient: (...args: unknown[]) => mockCreateSmtpClient(...args),
}));

vi.mock('@lib/Settings', () => ({
    readSetting: (...args: unknown[]) => mockReadSetting(...args),
}));

describe('InboxActions - sendInboxMessage', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockCreateSmtpClient.mockReset();
        mockReadSetting.mockReset();
        SetRecordErrorLogDeferDelegate(async () => undefined);
    });

    afterEach(() => {
        SetRecordErrorLogDeferDelegate(undefined);
    });

    it('rejects invalid recipient and CC addresses before sending', async () => {
        mockConnection.expect('selectOneRow', () => ({
            id: 3,
            address: 'volunteers@animecon.nl',
            canCreate: true,
            canRead: true,
            canDelete: false,
        }));

        const badRecipient = await sendInboxMessage(3, {
            recipient: 'not-an-email',
            subject: 'Hello',
            message: 'Body',
        });
        expect(badRecipient).toEqual({
            success: false,
            error: 'Please enter a valid recipient e-mail address.',
        });

        mockConnection.expect('selectOneRow', () => ({
            id: 3,
            address: 'volunteers@animecon.nl',
            canCreate: true,
            canRead: true,
            canDelete: false,
        }));

        const badCc = await sendInboxMessage(3, {
            recipient: 'alice@example.com',
            cc: 'valid@example.com, broken-address',
            subject: 'Hello',
            message: 'Body',
        });
        expect(badCc).toEqual({
            success: false,
            error: 'One or more CC e-mail addresses are invalid.',
        });

        expect(mockCreateSmtpClient).not.toHaveBeenCalled();
    });

    it('sends an e-mail via SMTP and persists the thread and message in the inbox', async () => {
        const smtpMock = new SmtpClientMock();
        smtpMock.mock.reset();
        mockCreateSmtpClient.mockResolvedValueOnce(smtpMock);
        mockReadSetting.mockResolvedValueOnce(' (AnimeCon)');

        // 1. requireInboxAccess('create'):
        mockConnection.expect('selectOneRow', () => ({
            id: 3,
            address: 'Volunteers@AnimeCon.nl',
            canCreate: true,
            canRead: true,
            canDelete: false,
        }));

        // 2. SMTP settings check:
        mockConnection.expect('selectOneRow', () => ({
            hostname: 'smtp.example.com',
            password: 'secret',
        }));

        // 3. Recipient lookup in `users`:
        mockConnection.expect('selectOneRow', (query, params) => {
            expect(query).toContain('from users');
            expect(params).toContain('alice@example.com');
            return { id: 42, name: 'Alice Wonderland' };
        });

        // 4. Transaction writing `inbox_threads` and `inbox_email`:
        mockConnection.expect('beginTransaction');
        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert into inbox_threads');
            expect(params).toContain(3);
            expect(params).toContain('Welcome aboard');
            expect(params).toContain('Alice Wonderland');
            expect(params).toContain('alice@example.com');
            expect(params).toContain(42); // volunteer userId
            expect(params).toContain(7);  // signed-in assignee userId
            return 900;
        });
        mockConnection.expect('selectOneColumnOneRow', query => {
            expect(query).toContain('from inbox_email');
            return 4;
        });
        mockConnection.expect('insert', (query, params) => {
            expect(query).toContain('insert into inbox_email');
            expect(params).toContain(3);
            expect(params).toContain(900);
            expect(params).toContain(0n);
            expect(params).toContain(5); // maxLocalUid (4) + 1
            expect(params).toContain('Peter Beverloo (AnimeCon)');
            expect(params).toContain('volunteers@animecon.nl');
            expect(params).toContain(7);
            expect(params).toContain('Re: Welcome aboard');
            return 1;
        });
        mockConnection.expect('commit');

        const result = await sendInboxMessage(3, {
            recipient: 'Alice@Example.com',
            cc: '"Bob, Jr." <bob@example.com>',
            subject: 'Re: Welcome aboard',
            message: 'Hello **Alice**!',
        });

        expect(result).toEqual({
            success: true,
            refresh: true,
            message: 'The message has been sent.',
        });

        const [ sentMail ] = smtpMock.mock.getSentMail();
        expect(sentMail).toMatchObject({
            from: 'Peter Beverloo (AnimeCon) <user@example.com>',
            to: '"Alice Wonderland" <alice@example.com>',
            cc: [ '"Bob, Jr." <bob@example.com>' ],
            subject: 'Re: Welcome aboard',
            html: '<p>Hello <strong>Alice</strong>!</p>',
            text: 'Hello **Alice**!',
        });
    });

    it('accepts Name <email> recipients chosen from the volunteer autocomplete', async () => {
        const smtpMock = new SmtpClientMock();
        smtpMock.mock.reset();
        mockCreateSmtpClient.mockResolvedValueOnce(smtpMock);
        mockReadSetting.mockResolvedValueOnce(' (AnimeCon)');

        mockConnection.expect('selectOneRow', () => ({
            id: 3,
            address: 'volunteers@animecon.nl',
            canCreate: true,
            canRead: true,
            canDelete: false,
        }));
        mockConnection.expect('selectOneRow', () => ({
            hostname: 'smtp.example.com',
            password: 'secret',
        }));
        mockConnection.expect('selectOneRow', (_query, params) => {
            expect(params).toContain('alice@example.com');
            return { id: 42, name: 'Alice Wonderland' };
        });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('insertReturningLastInsertedId', (_query, params) => {
            expect(params).toContain('Alice Wonderland');
            expect(params).toContain('alice@example.com');
            expect(params).toContain(42);
            return 901;
        });
        mockConnection.expect('selectOneColumnOneRow', () => 5);
        mockConnection.expect('insert', () => 1);
        mockConnection.expect('commit');

        const result = await sendInboxMessage(3, {
            recipient: 'Alice Wonderland <alice@example.com>',
            subject: 'Shift question',
            message: 'Can you help on Friday?',
        });

        expect(result).toEqual({
            success: true,
            refresh: true,
            message: 'The message has been sent.',
        });

        const [ sentMail ] = smtpMock.mock.getSentMail();
        expect(sentMail).toMatchObject({
            to: '"Alice Wonderland" <alice@example.com>',
            subject: 'Shift question',
        });
    });

    it('surfaces SMTP failures without persisting to the inbox tables', async () => {
        const smtpMock = new SmtpClientMock();
        smtpMock.mock.reset();
        smtpMock.mock.setShouldFailOnce(true);
        mockCreateSmtpClient.mockResolvedValueOnce(smtpMock);
        mockReadSetting.mockResolvedValueOnce('');

        mockConnection.expect('selectOneRow', () => ({
            id: 3,
            address: 'volunteers@animecon.nl',
            canCreate: true,
            canRead: true,
            canDelete: false,
        }));
        mockConnection.expect('selectOneRow', () => ({
            hostname: 'smtp.example.com',
            password: 'secret',
        }));
        mockConnection.expect('selectOneRow', () => undefined);

        const result = await sendInboxMessage(3, {
            recipient: 'stranger@example.com',
            subject: 'Ping',
            message: 'Are you there?',
        });

        expect(result).toEqual({
            success: false,
            error: 'Unable to send the e-mail: nodemailer-mock failure',
        });
    });
});
