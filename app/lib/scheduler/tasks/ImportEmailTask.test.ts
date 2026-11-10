// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ImportEmailTask } from './ImportEmailTask';
import { TaskContext } from '../TaskContext';
import { useMockConnection } from '@lib/database/Connection';

const mockCreateImapClient = vi.fn();

vi.mock('@lib/integrations/imap', () => ({
    createImapClient: (...args: unknown[]) => mockCreateImapClient(...args),
}));

describe('ImportEmailTask', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockCreateImapClient.mockReset();
    });

    it('runs as a simple task and succeeds when no IMAP accounts exist', async () => {
        mockConnection.expect('selectManyRows', query => {
            expect(query).not.toContain('<>');
            expect(query).not.toContain('!=');
            return [];
        });

        const context = TaskContext.forEphemeralTask('ImportEmailTask', null);
        const task = new ImportEmailTask(context);

        expect(task.isSimpleTask()).toBe(true);
        await expect(task.execute()).resolves.toBe(true);
    });

    it('imports a single batch of messages and attachments per account', async () => {
        mockConnection.expect('selectManyRows', () => [
            {
                id: 3,
                address: 'volunteers@animecon.nl',
                uidValidity: undefined,
                lastUid: undefined,
            },
        ]);

        const oversizedBytes = new Uint8Array(ImportEmailTask.kMaxAttachmentSizeBytes + 1);
        const pdfBytes = new Uint8Array([ 0x25, 0x50, 0x44, 0x46 ]);

        const mockReadMessages = vi.fn().mockResolvedValueOnce({
            uidValidity: 9001n,
            uidValidityReset: false,
            hasMore: true,
            messages: [
                {
                    uid: 10,
                    messageId: '<msg-10@example.com>',
                    inReplyTo: '<msg-1@example.com>',
                    date: Temporal.Instant.from('2026-11-09T10:00:00Z'),
                    receivedDate: Temporal.Instant.from('2026-11-09T10:01:00Z'),
                    from: [ { name: 'Alice', address: 'Alice@Example.com' } ],
                    to: [ { address: 'volunteers@animecon.nl' } ],
                    cc: [],
                    replyTo: [],
                    subject: 'Historical read message',
                    flags: [ '\\Seen' ],
                    text: 'Old body',
                    html: '<p>Old body</p>',
                    attachments: [
                        {
                            filename: 'form.pdf',
                            mimeType: 'application/pdf',
                            bytes: pdfBytes,
                        },
                    ],
                },
                {
                    uid: 11,
                    messageId: '<msg-11@example.com>',
                    date: Temporal.Instant.from('2026-11-10T12:00:00Z'),
                    receivedDate: Temporal.Instant.from('2026-11-10T12:02:00Z'),
                    from: [ { name: 'Bob', address: 'bob@example.com' } ],
                    to: [ { address: 'volunteers@animecon.nl' } ],
                    cc: [ { name: 'CC', address: 'cc@example.com' } ],
                    replyTo: [ { address: 'reply@example.com' } ],
                    subject: 'Unread message with oversized attachment',
                    flags: [],
                    text: 'New body',
                    attachments: [
                        {
                            filename: 'huge.zip',
                            mimeType: 'application/zip',
                            bytes: oversizedBytes,
                        },
                    ],
                },
            ],
        });

        mockCreateImapClient.mockResolvedValueOnce({ readMessages: mockReadMessages });

        // Message 1 (UID 10):
        mockConnection.expect('beginTransaction');
        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert ignore into inbox_email');
            expect(params).toContain(3);
            expect(params).toContain(9001n);
            expect(params).toContain(10);
            expect(params).toContain('alice@example.com');
            expect(params).toContain('2026-11-09 10:01:00'); // inbox_read populated from \Seen
            return 501;
        });
        mockConnection.expect('insert', (query, params) => {
            expect(query).toContain('insert into inbox_email_attachments');
            expect(params).toEqual([ 501, 'form.pdf', 'application/pdf', 4, pdfBytes ]);
            return 1;
        });
        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update email_accounts');
            expect(params).toEqual([ 9001n, 10, 3 ]);
            return 1;
        });
        mockConnection.expect('commit');

        // Message 2 (UID 11):
        mockConnection.expect('beginTransaction');
        mockConnection.expect('insertReturningLastInsertedId', query => {
            expect(query).toContain('insert ignore into inbox_email');
            return 502;
        });
        mockConnection.expect('insert', (query, params) => {
            expect(query).toContain('insert into inbox_email_attachments');
            expect(params).toEqual([
                502,
                'huge.zip',
                'application/zip',
                oversizedBytes.byteLength,
            ]);
            return 1;
        });
        mockConnection.expect('update', (_query, params) => {
            expect(params).toEqual([ 9001n, 11, 3 ]);
            return 1;
        });
        mockConnection.expect('commit');

        const context = TaskContext.forEphemeralTask('ImportEmailTask', null);
        const task = new ImportEmailTask(context);

        await expect(task.execute()).resolves.toBe(true);
        expect(context.intervalMsForTesting).toBeUndefined();

        expect(mockReadMessages).toHaveBeenCalledTimes(1);
        expect(mockReadMessages).toHaveBeenCalledWith({
            mailbox: 'INBOX',
            uidValidity: undefined,
            sinceUid: undefined,
            limit: ImportEmailTask.kBatchSize,
            markAsSeen: false,
        });

        expect(context.log.entries.some(
            e => e.severity === 'Warning' && e.message.includes('Omitting attachment bytes')))
            .toBe(true);
        expect(context.log.entries.some(
            e => e.severity === 'Info' && e.message.includes('Reached batch limit')))
            .toBe(true);
    });

    it('supports synchronizing an individual account via synchronizeAccount()', async () => {
        mockConnection.expect('selectOneRow', () => undefined);
        await expect(ImportEmailTask.synchronizeAccount(99)).resolves.toBe(false);

        mockConnection.expect('selectOneRow', (query, params) => {
            expect(query).toContain('email_account_id = ?');
            expect(params).toEqual([ 7 ]);
            return {
                id: 7,
                address: 'support@animecon.nl',
                uidValidity: 50n,
                lastUid: 12,
            };
        });

        const mockReadMessages = vi.fn().mockResolvedValueOnce({
            uidValidity: 50n,
            uidValidityReset: false,
            hasMore: false,
            messages: [],
        });
        mockCreateImapClient.mockResolvedValueOnce({ readMessages: mockReadMessages });

        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update email_accounts');
            expect(params).toEqual([ 50n, 12, 7 ]);
            return 1;
        });

        await expect(ImportEmailTask.synchronizeAccount(7)).resolves.toBe(true);
        expect(mockReadMessages).toHaveBeenCalledWith({
            mailbox: 'INBOX',
            uidValidity: 50n,
            sinceUid: 12,
            limit: ImportEmailTask.kBatchSize,
            markAsSeen: false,
        });
    });

    it('deduplicates existing messages by Message-ID on UIDVALIDITY reset', async () => {
        mockConnection.expect('selectManyRows', () => [
            {
                id: 4,
                address: 'info@animecon.nl',
                uidValidity: 100n,
                lastUid: 250,
            },
        ]);

        mockCreateImapClient.mockResolvedValueOnce({
            readMessages: vi.fn().mockResolvedValueOnce({
                uidValidity: 200n,
                uidValidityReset: true,
                hasMore: false,
                messages: [
                    {
                        uid: 1,
                        messageId: '<existing@animecon.nl>',
                        receivedDate: Temporal.Instant.from('2026-11-10T09:00:00Z'),
                        from: [],
                        to: [],
                        cc: [],
                        replyTo: [],
                        flags: [],
                        attachments: [],
                    },
                ],
            }),
        });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('selectOneColumnOneRow', () => 999);
        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update inbox_email set inbox_uid_validity = ?, inbox_uid = ?');
            expect(params).toEqual([ 200n, 1, 999 ]);
            return 1;
        });
        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update email_accounts');
            expect(params).toEqual([ 200n, 1, 4 ]);
            return 1;
        });
        mockConnection.expect('commit');

        const context = TaskContext.forEphemeralTask('ImportEmailTask', null);
        const task = new ImportEmailTask(context);

        await expect(task.execute()).resolves.toBe(true);
        expect(context.log.entries.some(
            e => e.severity === 'Warning' && e.message.includes('UIDVALIDITY changed')))
            .toBe(true);
    });

    it('isolates per-account failures so healthy accounts still synchronize', async () => {
        mockConnection.expect('selectManyRows', () => [
            { id: 1, address: 'broken@animecon.nl', uidValidity: 1n, lastUid: 5 },
            { id: 2, address: 'healthy@animecon.nl', uidValidity: 2n, lastUid: 8 },
        ]);

        mockCreateImapClient
            .mockRejectedValueOnce(new Error('Authentication failed'))
            .mockResolvedValueOnce({
                readMessages: vi.fn().mockResolvedValueOnce({
                    uidValidity: 3n,
                    uidValidityReset: true,
                    hasMore: false,
                    messages: [],
                }),
            });

        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update email_accounts');
            expect(params).toEqual([ 3n, null, 2 ]);
            return 1;
        });

        const context = TaskContext.forEphemeralTask('ImportEmailTask', null);
        const task = new ImportEmailTask(context);

        await expect(task.execute()).resolves.toBe(false);
        expect(context.log.entries.some(
            e => e.severity === 'Exception' && e.message.includes('broken@animecon.nl')))
            .toBe(true);
        expect(context.log.entries.some(
            e => e.severity === 'Info' && e.message.includes('healthy@animecon.nl')))
            .toBe(true);
    });
});
