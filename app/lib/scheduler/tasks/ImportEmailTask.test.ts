// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ImportEmailTask, normalizeThreadSubject } from './ImportEmailTask';
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
                    inReplyTo: '<msg-10@example.com>',
                    references: [ '<msg-1@example.com>', '<msg-10@example.com>' ],
                    date: Temporal.Instant.from('2026-11-10T12:00:00Z'),
                    receivedDate: Temporal.Instant.from('2026-11-10T12:02:00Z'),
                    from: [ { name: 'Bob', address: 'bob@example.com' } ],
                    to: [ { address: 'volunteers@animecon.nl' } ],
                    cc: [ { name: 'CC', address: 'cc@example.com' } ],
                    replyTo: [ { address: 'reply@example.com' } ],
                    subject: 'Re: Historical read message',
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

        // Message 1 (UID 10) — no matching parent in inbox or outbox, creates new thread 701:
        mockConnection.expect('beginTransaction');
        mockConnection.expect('selectOneColumnOneRow', (query, params) => {
            expect(query).toContain('from users');
            expect(params).toEqual([ 'alice@example.com' ]);
            return 42;
        });
        mockConnection.expect('selectOneRow', query => {
            expect(query).toContain('from inbox_email');
            return undefined;
        });
        mockConnection.expect('selectOneColumnOneRow', query => {
            expect(query).toContain('from outbox_email');
            return undefined;
        });
        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert into inbox_threads');
            expect(params).toContain(3);
            expect(params).toContain('Historical read message');
            expect(params).toContain('alice@example.com');
            expect(params).toContain(42);
            return 701;
        });
        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert ignore into inbox_email');
            expect(params).toContain(3);
            expect(params).toContain(701);
            expect(params).toContain(9001n);
            expect(params).toContain(10);
            expect(params).toContain('alice@example.com');
            expect(params).toContain(42);
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

        // Message 2 (UID 11) — matches existing thread 701 via In-Reply-To / References:
        mockConnection.expect('beginTransaction');
        mockConnection.expect('selectOneColumnOneRow', () => undefined); // bob@example.com unknown
        mockConnection.expect('selectOneRow', () => ({
            id: 701,
            latestDate: '2026-11-09 10:01:00',
        }));
        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert ignore into inbox_email');
            expect(params).toContain(701);
            expect(params).toContain('["<msg-1@example.com>","<msg-10@example.com>"]');
            return 502;
        });
        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update inbox_threads');
            expect(query).toContain('thread_resolved = ?');
            expect(params).toEqual([ '2026-11-10 12:02:00', 1, null, 701 ]);
            return 1;
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

    it('normalizes reply prefixes and bridges outbound outbox replies into threads', async () => {
        expect(normalizeThreadSubject('Re: Fwd: Re[2]: Shift swap')).toBe('Shift swap');
        expect(normalizeThreadSubject('Antw: Aw:   Hotel room  ')).toBe('Hotel room');
        expect(normalizeThreadSubject(undefined)).toBe('');

        mockConnection.expect('selectOneRow', () => ({
            id: 5,
            address: 'info@animecon.nl',
            uidValidity: 10n,
            lastUid: 20,
        }));

        mockCreateImapClient.mockResolvedValueOnce({
            readMessages: vi.fn().mockResolvedValueOnce({
                uidValidity: 10n,
                uidValidityReset: false,
                hasMore: false,
                messages: [
                    {
                        uid: 21,
                        messageId: '<reply-21@example.com>',
                        inReplyTo: '<outbox-sent@animecon.nl>',
                        receivedDate: Temporal.Instant.from('2026-11-12T15:00:00Z'),
                        from: [ { name: 'Visitor', address: 'visitor@example.com' } ],
                        to: [ { address: 'info@animecon.nl' } ],
                        cc: [],
                        replyTo: [],
                        subject: 'Re: Ticket question',
                        flags: [],
                        attachments: [],
                    },
                ],
            }),
        });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('selectOneColumnOneRow', () => undefined);
        mockConnection.expect('selectOneRow', () => undefined); // not in inbox_email
        mockConnection.expect('selectOneColumnOneRow', () => 88); // matched in outbox_email
        mockConnection.expect('selectOneRow', (_query, params) => {
            expect(params).toEqual([ 5, 'visitor@example.com', 'Ticket question', 1 ]);
            return {
                id: 300,
                latestDate: '2026-11-11 10:00:00',
            };
        });
        mockConnection.expect('insertReturningLastInsertedId', (_query, params) => {
            expect(params).toContain(300);
            return 601;
        });
        mockConnection.expect('update', (_query, params) => {
            expect(params).toEqual([ '2026-11-12 15:00:00', 1, null, 300 ]);
            return 1;
        });
        mockConnection.expect('update', () => 1);
        mockConnection.expect('commit');

        await expect(ImportEmailTask.synchronizeAccount(5)).resolves.toBe(true);
    });
});
