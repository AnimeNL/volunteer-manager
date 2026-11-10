// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FetchMessageObject, ImapFlowOptions, MailboxObject } from 'imapflow';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { vi } from 'vitest';

import { ImapClient, type ImapClientSettings } from './ImapClient';
import { Instrumentation } from '../Instrumentation';
import { createImapClient } from './index';
import { useMockConnection } from '@lib/database/Connection';

/**
 * State and mocked methods exposed by the fake `ImapFlow` instance in each test.
 */
interface MockImapFlowInstance extends EventEmitter {
    options: ImapFlowOptions;
    authenticated: boolean;
    greeting?: string;
    serverInfo: { name?: string; version?: string } | null;
    usable: boolean;
    isClosed: boolean;
    mailbox: MailboxObject | false;

    connect: ReturnType<typeof vi.fn>;
    getMailboxLock: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    fetchAll: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
    messageFlagsAdd: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
}

let lastInstance: MockImapFlowInstance | undefined;
let configureNextInstance: ((instance: MockImapFlowInstance) => void) | undefined;

vi.mock('imapflow', () => ({
    ImapFlow: class extends EventEmitter {
        options: ImapFlowOptions;
        authenticated = false;
        greeting: string | undefined = 'Dovecot ready.';
        serverInfo: { name?: string; version?: string } | null = { name: 'Dovecot' };
        usable = false;
        isClosed = false;
        mailbox: MailboxObject | false = false;

        connect = vi.fn(async () => {
            this.authenticated = true;
            if (this.options.verifyOnly) {
                this.isClosed = true;
            } else {
                this.usable = true;
            }
        });

        getMailboxLock = vi.fn(async (path: string, options?: { readOnly?: boolean }) => {
            this.mailbox = {
                path,
                delimiter: '/',
                flags: new Set([ '\\Seen', '\\Answered' ]),
                uidValidity: 9001n,
                uidNext: 100,
                exists: 5,
                readOnly: Boolean(options?.readOnly),
            };
            return {
                path,
                release: vi.fn(),
            };
        });

        search = vi.fn(async () => [] as number[] | false | undefined);
        fetchAll = vi.fn(async () => [] as FetchMessageObject[]);
        download = vi.fn(async () => ({}));
        messageFlagsAdd = vi.fn(async () => true);

        logout = vi.fn(async () => {
            this.usable = false;
            this.isClosed = true;
        });

        close = vi.fn(() => {
            this.usable = false;
            this.isClosed = true;
        });

        constructor(options: ImapFlowOptions) {
            super();
            this.options = options;
            lastInstance = this as unknown as MockImapFlowInstance;
            configureNextInstance?.(lastInstance);
        }
    },
}));

const kDefaultSettings: ImapClientSettings = {
    hostname: 'imap.animecon.nl',
    port: 993,
    username: 'volunteers@animecon.nl',
    password: 'top-secret-password',
};

describe('ImapClient', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        lastInstance = undefined;
        configureNextInstance = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exposes only verifyConfiguration() and readMessages() on the public prototype', () => {
        const publicMethods = Object.getOwnPropertyNames(ImapClient.prototype)
            .filter(name => name !== 'constructor')
            .sort();

        expect(publicMethods).toEqual([ 'readMessages', 'verifyConfiguration' ]);
    });

    it('instantiates via createImapClient() from database accounts', async () => {
        mockConnection.expect('selectOneRow');
        await expect(createImapClient(999)).rejects.toThrow('invalid account Id given');

        mockConnection.expect('selectOneRow', () => ({
            hostname: 'imap.animecon.nl',
            port: undefined,
            username: 'volunteers@animecon.nl',
            password: 'secret',
        }));
        await expect(createImapClient(7)).rejects.toThrow('incomplete IMAP configuration');

        mockConnection.expect('selectOneRow', () => ({
            hostname: 'imap.animecon.nl',
            port: 993,
            username: 'volunteers@animecon.nl',
            password: 'secret',
        }));
        const client = await createImapClient(7);
        expect(client).toBeInstanceOf(ImapClient);
    });

    it('verifies configuration on implicit TLS (993) and STARTTLS (143)', async () => {
        const loggedCalls: {
            integration: string;
            operation: string;
            status: string;
            input: string;
        }[] = [];
        mockConnection.expect('insert', (_query, params) => {
            loggedCalls.push({
                integration: params[0],
                operation: params[1],
                status: params[4],
                input: params[5],
            });
            return 1;
        });

        const tlsClient = new ImapClient(kDefaultSettings);
        await expect(tlsClient.verifyConfiguration()).resolves.toBe(true);

        expect(lastInstance?.options).toMatchObject({
            host: 'imap.animecon.nl',
            port: 993,
            secure: true,
            doSTARTTLS: false,
            verifyOnly: true,
            disableAutoIdle: true,
            logger: false,
            auth: {
                user: 'volunteers@animecon.nl',
                pass: 'top-secret-password',
            },
        });

        mockConnection.expect('insert', (_query, params) => {
            loggedCalls.push({
                integration: params[0],
                operation: params[1],
                status: params[4],
                input: params[5],
            });
            return 1;
        });

        const starttlsClient = new ImapClient({ ...kDefaultSettings, port: 143 });
        await expect(starttlsClient.verifyConfiguration()).resolves.toBe(true);

        expect(lastInstance?.options).toMatchObject({
            port: 143,
            secure: false,
            doSTARTTLS: true,
            verifyOnly: true,
        });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(loggedCalls).toHaveLength(2);
        expect(loggedCalls[0]).toMatchObject({
            integration: 'IMAP',
            operation: 'imaps://imap.animecon.nl:993/verifyConfiguration',
            status: 'Success',
        });
        expect(loggedCalls[0].input).not.toContain('top-secret-password');
        expect(loggedCalls[1]).toMatchObject({
            integration: 'IMAP',
            operation: 'imap://imap.animecon.nl:143/verifyConfiguration',
            status: 'Success',
        });
    });

    it('records Exception when verifyConfiguration() fails and closes socket', async () => {
        let insertedParams: unknown[] = [];
        mockConnection.expect('insert', (_query, params) => {
            insertedParams = params;
            return 1;
        });

        configureNextInstance = instance => {
            instance.connect.mockRejectedValueOnce(new Error('Invalid credentials'));
        };

        const client = new ImapClient(kDefaultSettings);
        await expect(client.verifyConfiguration()).rejects.toThrow('Invalid credentials');
        expect(lastInstance?.close).toHaveBeenCalledTimes(1);

        await new Promise(resolve => setTimeout(resolve, 0));
        expect(insertedParams).toContain('IMAP');
        expect(insertedParams).toContain('Exception');
        expect(insertedParams).toContain('Invalid credentials');
    });

    it('hydrates multipart messages and records one holistic integration log entry', async () => {
        const loggedRows: {
            operation: string;
            status: string;
            input?: string;
            output?: string;
        }[] = [];
        mockConnection.expect('insert', (_query, params) => {
            loggedRows.push({
                operation: params[1],
                status: params[4],
                input: params[5],
                output: params[6],
            });
            return 1;
        });

        let lockReleaseSpy!: ReturnType<typeof vi.fn>;
        configureNextInstance = instance => {
            instance.getMailboxLock.mockImplementationOnce(async (path: string) => {
                instance.mailbox = {
                    path,
                    delimiter: '/',
                    flags: new Set([ '\\Seen' ]),
                    uidValidity: 42n,
                    uidNext: 20,
                    exists: 2,
                    readOnly: true,
                };
                lockReleaseSpy = vi.fn();
                return { path, release: lockReleaseSpy };
            });

            instance.search.mockResolvedValueOnce([ 15 ]);
            instance.fetchAll.mockResolvedValueOnce([
                {
                    seq: 1,
                    uid: 15,
                    size: 4096,
                    flags: new Set([ '\\Answered' ]),
                    internalDate: new Date('2026-11-10T10:05:00Z'),
                    envelope: {
                        date: new Date('2026-11-10T10:00:00Z'),
                        subject: 'Volunteer shift question',
                        messageId: '<msg-15@example.com>',
                        inReplyTo: '<msg-10@example.com>',
                        from: [ { name: 'Alice', address: 'alice@example.com' } ],
                        to: [ { address: 'volunteers@animecon.nl' } ],
                        cc: [ { name: 'Bob', address: 'bob@example.com' } ],
                        replyTo: [ { address: 'alice-reply@example.com' } ],
                    },
                    bodyStructure: {
                        type: 'multipart/mixed',
                        childNodes: [
                            {
                                part: '1',
                                type: 'multipart/alternative',
                                childNodes: [
                                    { part: '1.1', type: 'text/plain' },
                                    { part: '1.2', type: 'text/html' },
                                ],
                            },
                            {
                                part: '2',
                                type: 'application/pdf',
                                disposition: 'attachment',
                                dispositionParameters: { filename: 'schedule.pdf' },
                            },
                        ],
                    },
                },
            ]);

            instance.download.mockImplementation(
                async (_uid: number, part?: string, options?: { decodeText?: boolean }) => {
                    switch (part) {
                        case '1.1':
                            expect(options?.decodeText).toBe(true);
                            return {
                                meta: { contentType: 'text/plain' },
                                content: Readable.from([ Buffer.from('Hello plain world!') ]),
                            };

                        case '1.2':
                            expect(options?.decodeText).toBe(true);
                            return {
                                meta: { contentType: 'text/html' },
                                content: Readable.from([ Buffer.from('<p>Hello HTML world!</p>') ]),
                            };

                        case '2':
                            expect(options?.decodeText).toBe(false);
                            return {
                                meta: {
                                    contentType: 'application/pdf',
                                    filename: 'schedule-decoded.pdf',
                                },
                                content: Readable.from([
                                    Uint8Array.from([ 0x25, 0x50, 0x44, 0x46 ]),
                                ]),
                            };

                        default:
                            return {};
                    }
                });
        };

        const client = new ImapClient(kDefaultSettings);
        const result = await client.readMessages();

        expect(result).toEqual({
            uidValidity: 42n,
            uidValidityReset: false,
            hasMore: false,
            messages: [
                {
                    uid: 15,
                    messageId: '<msg-15@example.com>',
                    inReplyTo: '<msg-10@example.com>',
                    date: Temporal.Instant.from('2026-11-10T10:00:00Z'),
                    receivedDate: Temporal.Instant.from('2026-11-10T10:05:00Z'),
                    from: [ { name: 'Alice', address: 'alice@example.com' } ],
                    to: [ { address: 'volunteers@animecon.nl' } ],
                    cc: [ { name: 'Bob', address: 'bob@example.com' } ],
                    replyTo: [ { address: 'alice-reply@example.com' } ],
                    subject: 'Volunteer shift question',
                    flags: [ '\\Answered' ],
                    text: 'Hello plain world!',
                    html: '<p>Hello HTML world!</p>',
                    attachments: [
                        {
                            filename: 'schedule-decoded.pdf',
                            mimeType: 'application/pdf',
                            bytes: new Uint8Array([ 0x25, 0x50, 0x44, 0x46 ]),
                        },
                    ],
                },
            ],
        });

        expect(lastInstance?.messageFlagsAdd).not.toHaveBeenCalled();
        expect(lockReleaseSpy).toHaveBeenCalledTimes(1);
        expect(lastInstance?.logout).toHaveBeenCalledTimes(1);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(loggedRows).toHaveLength(1);
        expect(loggedRows[0].operation).toBe('imaps://imap.animecon.nl:993/readMessages');
        expect(loggedRows[0].status).toBe('Success');

        const parsedOutput = JSON.parse(loggedRows[0].output!);
        expect(parsedOutput).toMatchObject({
            matchedCount: 1,
            fetchedCount: 1,
            hasMore: false,
            mailbox: {
                path: 'INBOX',
                uidValidity: '42',
                uidNext: 20,
                exists: 2,
                readOnly: true,
            },
            messages: [
                {
                    uid: 15,
                    size: 4096,
                    downloadedBytes: 46,
                    attachmentCount: 1,
                },
            ],
        });

        const combinedLogs = JSON.stringify(loggedRows);
        expect(combinedLogs).not.toContain('top-secret-password');
        expect(combinedLogs).not.toContain('Hello plain world!');
        expect(combinedLogs).not.toContain('Hello HTML world!');
    });

    it('handles single-part messages, filtering options, and markAsSeen', async () => {
        const instrumentationInstances: Instrumentation[] = [];
        const originalWithContext = Instrumentation.withContext.bind(Instrumentation);
        vi.spyOn(Instrumentation, 'withContext').mockImplementation(context => {
            mockConnection.expect('insert');
            const instance = originalWithContext(context);
            instrumentationInstances.push(instance);
            return instance;
        });

        configureNextInstance = instance => {
            instance.search.mockResolvedValueOnce([ 50, 51, 52 ]);
            instance.fetchAll.mockResolvedValueOnce([
                {
                    seq: 2,
                    uid: 51,
                    internalDate: new Date('2026-11-10T08:00:00Z'),
                    envelope: { subject: 'Too early' },
                    bodyStructure: { type: 'text/plain' },
                },
                {
                    seq: 3,
                    uid: 52,
                    flags: new Set(),
                    internalDate: new Date('2026-11-10T12:30:00Z'),
                    envelope: {
                        date: 'invalid-date-header',
                        subject: 'Single part message',
                        from: [ { address: 'sender@example.com' }, { name: 'No Address' } ],
                    },
                    bodyStructure: { type: 'text/plain' },
                },
            ]);

            instance.download.mockResolvedValueOnce({
                meta: { contentType: 'text/plain' },
                content: Readable.from([ Buffer.from('Body of UID 52') ]),
            });
        };

        const sinceDate = Temporal.Instant.from('2026-11-10T12:00:00Z');
        const client = new ImapClient(kDefaultSettings);
        const result = await client.readMessages({
            mailbox: 'Support',
            unseenOnly: true,
            sinceUid: 50,
            sinceDate,
            markAsSeen: true,
        });

        expect(lastInstance?.getMailboxLock).toHaveBeenCalledWith('Support', { readOnly: false });
        expect(lastInstance?.search).toHaveBeenCalledWith({
            seen: false,
            uid: '51:*',
            since: new Date(sinceDate.epochMilliseconds - 86_400_000),
        }, { uid: true });

        expect(lastInstance?.fetchAll).toHaveBeenCalledWith(
            [ 51, 52 ], expect.any(Object), { uid: true });

        expect(lastInstance?.download).toHaveBeenCalledTimes(1);
        expect(lastInstance?.download).toHaveBeenCalledWith(
            52, 'TEXT', { uid: true, decodeText: true });
        expect(lastInstance?.messageFlagsAdd).toHaveBeenCalledWith(
            [ 52 ], [ '\\Seen' ], { uid: true });

        expect(result).toEqual({
            uidValidity: 9001n,
            uidValidityReset: false,
            hasMore: false,
            messages: [
                {
                    uid: 52,
                    date: Temporal.Instant.from('2026-11-10T12:30:00Z'),
                    receivedDate: Temporal.Instant.from('2026-11-10T12:30:00Z'),
                    from: [ { address: 'sender@example.com' } ],
                    to: [],
                    cc: [],
                    replyTo: [],
                    subject: 'Single part message',
                    flags: [],
                    text: 'Body of UID 52',
                    attachments: [],
                },
            ],
        });

        await Promise.all(instrumentationInstances.map(i => i.completionPromise));
        expect(instrumentationInstances.map(i => i.contextForTesting.operation)).toEqual([
            'imaps://imap.animecon.nl:993/readMessages',
        ]);
        expect(instrumentationInstances[0].statusForTesting.durationTimeToFirstByteMs)
            .toBeGreaterThanOrEqual(0);
    });

    it('supports batch limits and detects server UIDVALIDITY resets', async () => {
        await expect(new ImapClient(kDefaultSettings).readMessages({ limit: 0 }))
            .rejects.toThrow('The "limit" option must be a positive integer.');

        for (let i = 0; i < 2; ++i)
            mockConnection.expect('insert');

        configureNextInstance = instance => {
            instance.getMailboxLock.mockImplementationOnce(async (path: string) => {
                instance.mailbox = {
                    path,
                    delimiter: '/',
                    flags: new Set(),
                    uidValidity: 9002n,
                    uidNext: 4,
                    exists: 3,
                    readOnly: true,
                };
                return { path, release: vi.fn() };
            });
            instance.search.mockResolvedValueOnce([ 3, 1, 2 ]);
            instance.fetchAll.mockResolvedValueOnce([
                {
                    seq: 1,
                    uid: 1,
                    internalDate: new Date('2026-11-10T10:00:00Z'),
                    envelope: { subject: 'First' },
                    bodyStructure: { type: 'text/plain' },
                },
                {
                    seq: 2,
                    uid: 2,
                    internalDate: new Date('2026-11-10T10:01:00Z'),
                    envelope: { subject: 'Second' },
                    bodyStructure: { type: 'text/plain' },
                },
            ]);
            instance.download
                .mockResolvedValueOnce({
                    meta: { contentType: 'text/plain' },
                    content: Readable.from([ Buffer.from('One') ]),
                })
                .mockResolvedValueOnce({
                    meta: { contentType: 'text/plain' },
                    content: Readable.from([ Buffer.from('Two') ]),
                });
        };

        const client = new ImapClient(kDefaultSettings);
        const resetResult = await client.readMessages({
            uidValidity: 9001n,
            sinceUid: 500,
            limit: 2,
        });

        // Stale `sinceUid: 500` must be ignored because `uidValidity` changed from 9001n to 9002n.
        expect(lastInstance?.search).toHaveBeenCalledWith({ all: true }, { uid: true });
        expect(lastInstance?.fetchAll).toHaveBeenCalledWith(
            [ 1, 2 ], expect.any(Object), { uid: true });
        expect(resetResult.uidValidity).toBe(9002n);
        expect(resetResult.uidValidityReset).toBe(true);
        expect(resetResult.hasMore).toBe(true);
        expect(resetResult.messages.map(m => m.uid)).toEqual([ 1, 2 ]);

        configureNextInstance = instance => {
            instance.getMailboxLock.mockImplementationOnce(async (path: string) => {
                instance.mailbox = {
                    path,
                    delimiter: '/',
                    flags: new Set(),
                    uidValidity: 9002n,
                    uidNext: 4,
                    exists: 3,
                    readOnly: true,
                };
                return { path, release: vi.fn() };
            });
            instance.search.mockResolvedValueOnce([ 3 ]);
            instance.fetchAll.mockResolvedValueOnce([
                {
                    seq: 3,
                    uid: 3,
                    internalDate: new Date('2026-11-10T10:02:00Z'),
                    envelope: { subject: 'Third' },
                    bodyStructure: { type: 'text/plain' },
                },
            ]);
            instance.download.mockResolvedValueOnce({
                meta: { contentType: 'text/plain' },
                content: Readable.from([ Buffer.from('Three') ]),
            });
        };

        const finalBatch = await client.readMessages({
            uidValidity: 9002n,
            sinceUid: 2,
            limit: 2,
        });

        expect(finalBatch.uidValidityReset).toBe(false);
        expect(finalBatch.hasMore).toBe(false);
        expect(finalBatch.messages.map(m => m.uid)).toEqual([ 3 ]);

        await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('short-circuits cleanly when the mailbox is empty or already caught up', async () => {
        for (let i = 0; i < 2; ++i)
            mockConnection.expect('insert');

        configureNextInstance = instance => {
            instance.getMailboxLock.mockImplementationOnce(async (path: string) => {
                instance.mailbox = {
                    path,
                    delimiter: '/',
                    flags: new Set(),
                    uidValidity: 1n,
                    uidNext: 1,
                    exists: 0,
                    readOnly: true,
                };
                return { path, release: vi.fn() };
            });
        };

        const client = new ImapClient(kDefaultSettings);
        await expect(client.readMessages()).resolves.toEqual({
            uidValidity: 1n,
            uidValidityReset: false,
            hasMore: false,
            messages: [],
        });
        expect(lastInstance?.search).not.toHaveBeenCalled();
        expect(lastInstance?.logout).toHaveBeenCalledTimes(1);

        configureNextInstance = instance => {
            instance.getMailboxLock.mockImplementationOnce(async (path: string) => {
                instance.mailbox = {
                    path,
                    delimiter: '/',
                    flags: new Set(),
                    uidValidity: 1n,
                    uidNext: 25,
                    exists: 10,
                    readOnly: true,
                };
                return { path, release: vi.fn() };
            });
        };

        await expect(client.readMessages({ uidValidity: 1n, sinceUid: 25 })).resolves.toEqual({
            uidValidity: 1n,
            uidValidityReset: false,
            hasMore: false,
            messages: [],
        });
        expect(lastInstance?.search).not.toHaveBeenCalled();
        expect(lastInstance?.logout).toHaveBeenCalledTimes(1);

        await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('preserves primary errors when logout also fails during teardown', async () => {
        mockConnection.expect('insert');

        configureNextInstance = instance => {
            instance.search.mockResolvedValueOnce(false);
            instance.logout.mockRejectedValueOnce(new Error('Broken pipe during logout'));
        };

        const client = new ImapClient(kDefaultSettings);
        await expect(client.readMessages()).rejects.toThrow(
            'IMAP SEARCH command was rejected for mailbox "INBOX".');
        expect(lastInstance?.close).toHaveBeenCalledTimes(1);

        await new Promise(resolve => setTimeout(resolve, 0));
    });
});
