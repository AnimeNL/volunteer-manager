// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FetchMessageObject, FetchQueryObject, MessageAddressObject, MessageStructureObject, SearchObject } from 'imapflow';
import { ImapFlow } from 'imapflow';
import { buffer as readStreamToBuffer } from 'node:stream/consumers';

import type { ImapAddress, ImapAttachment, ImapMessage, ImapReadMessagesOptions } from './ImapTypes';
import { Instrumentation } from '../Instrumentation';

/**
 * Connection and authentication settings required by `ImapClient`.
 */
export interface ImapClientSettings {
    hostname: string;
    port: number;
    username: string;
    password: string;
}

/**
 * Describes a leaf MIME part discovered in a message's `BODYSTRUCTURE`.
 */
interface BodyPart {
    part: string;
    kind: 'text' | 'html' | 'attachment';
    mimeType: string;
    filename?: string;
}

/**
 * Metadata fields requested from the IMAP server before downloading individual MIME parts.
 */
const kFetchQuery: FetchQueryObject = {
    uid: true,
    flags: true,
    internalDate: true,
    envelope: true,
    bodyStructure: true,
};

/**
 * Client for reading inbound e-mail messages from an IMAP server using `imapflow`, recording all
 * server round-trips to the `integrations_logs` table.
 */
export class ImapClient {
    #settings: ImapClientSettings;

    constructor(settings: ImapClientSettings) {
        this.#settings = settings;
    }

    /**
     * Verifies that the configured IMAP server is reachable and accepts our credentials.
     */
    async verifyConfiguration(): Promise<true> {
        await this.#withConnection(/* verifyOnly= */ true, async () => undefined);
        return true;
    }

    /**
     * Opens the target mailbox, retrieves all messages matching `options` (including decoded
     * text/HTML bodies and attachments), and optionally marks them as `\Seen`.
     */
    async readMessages(options?: ImapReadMessagesOptions): Promise<ImapMessage[]> {
        const mailbox = options?.mailbox ?? 'INBOX';
        const readOnly = !options?.markAsSeen;

        return this.#withConnection(/* verifyOnly= */ false, async connection => {
            const lock = await this.#execute(
                'getMailboxLock',
                () => connection.getMailboxLock(mailbox, { readOnly }),
                { mailbox, readOnly },
                () => connection.mailbox || undefined);

            try {
                const uids = await this.#searchUids(connection, mailbox, options);
                if (!uids.length)
                    return [];

                const fetched = await this.#execute(
                    'fetchAll',
                    () => connection.fetchAll(uids, kFetchQuery, { uid: true }),
                    { mailbox, uids },
                    messages => messages.map(m => ({ uid: m.uid, size: m.size })));

                const messages: ImapMessage[] = [];
                for (const item of fetched.sort((lhs, rhs) => lhs.uid - rhs.uid)) {
                    if (!isOnOrAfter(item, options?.sinceDate))
                        continue;

                    messages.push(await this.#readMessage(connection, mailbox, item));
                }

                if (options?.markAsSeen && messages.length > 0) {
                    const seenUids = messages.map(message => message.uid);
                    await this.#execute('messageFlagsAdd', async () => {
                        const updated = await connection.messageFlagsAdd(
                            seenUids, [ '\\Seen' ], { uid: true });
                        if (!updated)
                            throw new Error(`Unable to mark messages as \\Seen in "${mailbox}".`);
                    }, { mailbox, uids: seenUids });
                }

                return messages;
            } finally {
                lock.release();
            }
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Internal behaviour:
    // ---------------------------------------------------------------------------------------------

    /**
     * Searches `mailbox` for message UIDs matching `options`, sorted in ascending order.
     */
    async #searchUids(
        connection: ImapFlow, mailbox: string, options?: ImapReadMessagesOptions): Promise<number[]>
    {
        if (connection.mailbox) {
            if (connection.mailbox.exists === 0)
                return [];
            if (options?.sinceUid !== undefined && connection.mailbox.uidNext <= options.sinceUid)
                return [];
        }

        const query: SearchObject = {};
        if (options?.unseenOnly)
            query.seen = false;
        if (options?.sinceUid !== undefined)
            query.uid = `${Math.max(1, options.sinceUid + 1)}:*`;
        if (options?.sinceDate !== undefined) {
            // Pad by 24h because IMAP `SINCE` compares calendar dates without timezones.
            query.since = new Date(
                options.sinceDate.epochMilliseconds - /* 24 hours= */ 86_400_000);
        }
        if (!Object.keys(query).length)
            query.all = true;

        const uids = await this.#execute('search', async () => {
            const result = await connection.search(query, { uid: true });
            if (result === false)
                throw new Error(`IMAP SEARCH command was rejected for mailbox "${mailbox}".`);

            return result ?? [];
        }, { mailbox, query });

        return uids
            .filter(uid => options?.sinceUid === undefined || uid > options.sinceUid)
            .sort((lhs, rhs) => lhs - rhs);
    }

    /**
     * Downloads all leaf MIME parts for `fetched` and assembles an `ImapMessage`.
     */
    async #readMessage(
        connection: ImapFlow, mailbox: string, fetched: FetchMessageObject): Promise<ImapMessage>
    {
        const textParts: string[] = [];
        const htmlParts: string[] = [];
        const attachments: ImapAttachment[] = [];

        for (const part of collectBodyParts(fetched.bodyStructure)) {
            const decodeText = part.kind !== 'attachment';
            const downloaded = await this.#execute(
                'download',
                async ({ markFirstByte }) => {
                    const { content, meta } = await connection.download(fetched.uid, part.part, {
                        uid: true,
                        decodeText,
                    });

                    markFirstByte();
                    if (!content)
                        return undefined;

                    return {
                        buffer: await readStreamToBuffer(content),
                        filename: meta.filename ?? part.filename,
                        mimeType: (meta.contentType ?? part.mimeType).toLowerCase(),
                    };
                },
                { mailbox, uid: fetched.uid, part: part.part },
                result => result && {
                    byteLength: result.buffer.byteLength,
                    contentType: result.mimeType,
                    filename: result.filename,
                });

            if (!downloaded)
                continue;

            if (part.kind === 'text') {
                textParts.push(downloaded.buffer.toString('utf8'));
            } else if (part.kind === 'html') {
                htmlParts.push(downloaded.buffer.toString('utf8'));
            } else {
                attachments.push({
                    filename: downloaded.filename,
                    mimeType: downloaded.mimeType,
                    bytes: new Uint8Array(downloaded.buffer),
                });
            }
        }

        const receivedDate = toInstant(fetched.internalDate);
        const date = toInstant(fetched.envelope?.date) ?? receivedDate;
        const envelope = fetched.envelope;

        return {
            uid: fetched.uid,
            messageId: envelope?.messageId || undefined,
            inReplyTo: envelope?.inReplyTo || undefined,
            date,
            receivedDate,
            from: normalizeAddresses(envelope?.from),
            to: normalizeAddresses(envelope?.to),
            cc: normalizeAddresses(envelope?.cc),
            replyTo: normalizeAddresses(envelope?.replyTo),
            subject: envelope?.subject,
            flags: fetched.flags ? [ ...fetched.flags ] : [],
            text: textParts.length ? textParts.join('\n') : undefined,
            html: htmlParts.length ? htmlParts.join('\n') : undefined,
            attachments,
        };
    }

    /**
     * Opens an `ImapFlow` connection, runs `callback`, and ensures clean logout/socket teardown.
     */
    async #withConnection<T>(
        verifyOnly: boolean, callback: (connection: ImapFlow) => Promise<T>): Promise<T>
    {
        const secure = this.#settings.port === 993;
        const connection = new ImapFlow({
            host: this.#settings.hostname,
            port: this.#settings.port,
            secure,
            doSTARTTLS: !secure,
            auth: {
                user: this.#settings.username,
                pass: this.#settings.password,
            },
            connectionTimeout: /* 10 seconds= */ 10_000,
            greetingTimeout: /* 10 seconds= */ 10_000,
            disableAutoIdle: true,
            logger: false,
            verifyOnly,
        });

        connection.on('error', () => undefined);

        try {
            await this.#execute(
                'connect',
                () => connection.connect(),
                { username: this.#settings.username, secure, verifyOnly },
                () => ({ greeting: connection.greeting, serverInfo: connection.serverInfo }));

            return await callback(connection);
        } finally {
            if (!verifyOnly && connection.usable && !connection.isClosed)
                await this.#execute('logout', () => connection.logout()).catch(() => undefined);
            if (!connection.isClosed)
                connection.close();
        }
    }

    /**
     * Executes an instrumented `ImapFlow` server operation under `integration: 'IMAP'`.
     */
    #execute<T>(
        command: string,
        callback: (context: { markFirstByte: () => void }) => Promise<T>,
        input?: unknown,
        output: (result: T) => unknown = result => result): Promise<T>
    {
        const scheme = this.#settings.port === 993 ? 'imaps' : 'imap';
        const instrumentation = Instrumentation.withContext({
            integration: 'IMAP',
            operation: `${scheme}://${this.#settings.hostname}:${this.#settings.port}/${command}`,
        });

        return instrumentation.instrumentedCall(callback, { input, output });
    }
}

/**
 * Flattens an IMAP `BODYSTRUCTURE` tree into leaf text, HTML, and attachment parts.
 */
function collectBodyParts(node?: MessageStructureObject): BodyPart[] {
    if (!node)
        return [];

    const mimeType = node.type.toLowerCase();
    if (mimeType.startsWith('multipart/'))
        return (node.childNodes ?? []).flatMap(collectBodyParts);

    const part = node.part ?? 'TEXT';
    const filename = node.dispositionParameters?.filename ?? node.parameters?.name;
    const isAttachment = node.disposition === 'attachment' || Boolean(filename);

    if (!isAttachment && mimeType === 'text/plain')
        return [ { part, kind: 'text', mimeType } ];
    if (!isAttachment && mimeType === 'text/html')
        return [ { part, kind: 'html', mimeType } ];

    return [ { part, kind: 'attachment', mimeType, filename } ];
}

/**
 * Returns whether `fetched` arrived at or after `sinceDate` (when given).
 */
function isOnOrAfter(fetched: FetchMessageObject, sinceDate?: Temporal.Instant): boolean {
    if (!sinceDate)
        return true;

    const timestamp = toInstant(fetched.internalDate) ?? toInstant(fetched.envelope?.date);
    return !!timestamp && Temporal.Instant.compare(timestamp, sinceDate) >= 0;
}

/**
 * Normalizes `imapflow` envelope addresses into `ImapAddress` entries.
 */
function normalizeAddresses(addresses?: MessageAddressObject[]): ImapAddress[] {
    const normalized: ImapAddress[] = [];
    for (const entry of addresses ?? []) {
        const address = entry.address?.trim();
        if (address)
            normalized.push({ name: entry.name?.trim() || undefined, address });
    }

    return normalized;
}

/**
 * Converts a `Date` or date string into a `Temporal.Instant` when valid.
 */
function toInstant(value?: Date | string): Temporal.Instant | undefined {
    if (!value)
        return undefined;

    const epochMs = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(epochMs) ? Temporal.Instant.fromEpochMilliseconds(epochMs) : undefined;
}
