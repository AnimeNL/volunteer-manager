// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FetchMessageObject, FetchQueryObject, MailboxObject, MessageAddressObject, MessageStructureObject, SearchObject } from 'imapflow';
import { ImapFlow } from 'imapflow';
import { buffer as readStreamToBuffer } from 'node:stream/consumers';

import type { ImapAddress, ImapAttachment, ImapMessage, ImapReadMessagesOptions, ImapReadMessagesResult } from './ImapTypes';
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
 * Per-message summary recorded in `integrations_logs` for `readMessages()`.
 */
interface MessageTelemetry {
    uid: number;
    size?: number;
    downloadedBytes: number;
    attachmentCount: number;
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
 * Client for reading inbound e-mail messages from an IMAP server using `imapflow`, recording one
 * holistic `integrations_logs` entry per operation.
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
        await this.#runSession('verifyConfiguration', { verifyOnly: true }, async () => undefined);
        return true;
    }

    /**
     * Opens the target mailbox, retrieves messages matching `options` (including decoded text/HTML
     * bodies and attachments), and optionally marks them as `\Seen`.
     */
    async readMessages(options?: ImapReadMessagesOptions): Promise<ImapReadMessagesResult> {
        if (options?.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1))
            throw new Error('The "limit" option must be a positive integer.');

        const mailbox = options?.mailbox ?? 'INBOX';
        const readOnly = !options?.markAsSeen;
        const input = {
            ...options,
            mailbox,
            readOnly,
            sinceDate: options?.sinceDate?.toString(),
        };

        return this.#runSession('readMessages', { input }, async (connection, sessionLog) => {
            const lock = await connection.getMailboxLock(mailbox, { readOnly });
            try {
                const mailboxInfo = connection.mailbox || undefined;
                const uidValidity = mailboxInfo?.uidValidity;
                const uidValidityReset =
                    options?.uidValidity !== undefined &&
                    uidValidity !== undefined &&
                    uidValidity !== options.uidValidity;

                // Ignore `sinceUid` when `UIDVALIDITY` changed so sync restarts from UID 1.
                const sinceUid = uidValidityReset ? undefined : options?.sinceUid;
                const selection =
                    await this.#selectMessages(connection, mailbox, options, sinceUid);

                const messages: ImapMessage[] = [];
                const messageLogs: MessageTelemetry[] = [];

                for (const item of selection.items) {
                    const { message, downloadedBytes } =
                        await this.#downloadMessage(connection, item);

                    messages.push(message);
                    messageLogs.push({
                        uid: message.uid,
                        size: item.size,
                        downloadedBytes,
                        attachmentCount: message.attachments.length,
                    });
                }

                const markedAsSeen = Boolean(options?.markAsSeen && messages.length > 0);
                if (markedAsSeen) {
                    const seenUids = messages.map(message => message.uid);
                    const updated = await connection.messageFlagsAdd(
                        seenUids, [ '\\Seen' ], { uid: true });
                    if (!updated)
                        throw new Error(`Unable to mark messages as \\Seen in "${mailbox}".`);
                }

                Object.assign(sessionLog, {
                    mailbox: summarizeMailbox(mailboxInfo),
                    uidValidityReset: uidValidityReset || undefined,
                    matchedCount: selection.matchedCount,
                    fetchedCount: messages.length,
                    hasMore: selection.hasMore,
                    markedAsSeen: markedAsSeen || undefined,
                    messages: messageLogs,
                });

                return {
                    uidValidity,
                    uidValidityReset,
                    hasMore: selection.hasMore,
                    messages,
                };
            } finally {
                lock.release();
            }
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Internal behaviour:
    // ---------------------------------------------------------------------------------------------

    /**
     * Connects to the IMAP server, executes `callback`, tears down the connection cleanly, and
     * records a single `integrations_logs` entry covering the session.
     */
    async #runSession<T>(
        operationName: string,
        options: { verifyOnly?: boolean; input?: Record<string, unknown> },
        callback: (connection: ImapFlow, sessionLog: Record<string, unknown>) => Promise<T>)
            : Promise<T>
    {
        const secure = this.#settings.port === 993;
        const scheme = secure ? 'imaps' : 'imap';

        const instrumentation = Instrumentation.withContext({
            integration: 'IMAP',
            operation:
                `${scheme}://${this.#settings.hostname}:${this.#settings.port}/${operationName}`,
        });

        const sessionLog: Record<string, unknown> = {};

        return instrumentation.instrumentedCall(async ({ markFirstByte }) => {
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
                verifyOnly: Boolean(options.verifyOnly),
            });

            connection.on('error', () => undefined);

            try {
                await connection.connect();
                markFirstByte();

                sessionLog.greeting = connection.greeting;
                sessionLog.serverInfo = connection.serverInfo;

                return await callback(connection, sessionLog);
            } finally {
                if (connection.usable && !connection.isClosed)
                    await connection.logout().catch(() => undefined);
                if (!connection.isClosed)
                    connection.close();
            }
        }, {
            input: {
                username: this.#settings.username,
                secure,
                ...options.input,
            },
            output: () => sessionLog,
        });
    }

    /**
     * Finds matching messages in `mailbox` and fetches their envelopes and `BODYSTRUCTURE`,
     * applying `options.limit` and `options.sinceDate`.
     */
    async #selectMessages(
        connection: ImapFlow,
        mailbox: string,
        options: ImapReadMessagesOptions | undefined,
        sinceUid: number | undefined)
    {
        const candidateUids = await this.#searchUids(connection, mailbox, options, sinceUid);
        if (!candidateUids.length)
            return { items: [], matchedCount: 0, hasMore: false };

        const limit = options?.limit;
        const sinceDate = options?.sinceDate;

        // Without `sinceDate`, every searched UID is an exact match, so we can slice to `limit`
        // before fetching message metadata from the server.
        if (!sinceDate) {
            const uidsToFetch = limit ? candidateUids.slice(0, limit) : candidateUids;
            const items = await connection.fetchAll(uidsToFetch, kFetchQuery, { uid: true });
            items.sort((lhs, rhs) => lhs.uid - rhs.uid);

            return {
                items,
                matchedCount: candidateUids.length,
                hasMore: Boolean(limit && candidateUids.length > limit),
            };
        }

        // IMAP's `SINCE` search key has day-only precision without timezones, so `#searchUids()`
        // pads by 24 hours and we filter on exact `INTERNALDATE` before applying `limit`.
        const fetched = await connection.fetchAll(candidateUids, kFetchQuery, { uid: true });
        const matched = fetched
            .filter(item => isOnOrAfter(item, sinceDate))
            .sort((lhs, rhs) => lhs.uid - rhs.uid);

        return {
            items: limit ? matched.slice(0, limit) : matched,
            matchedCount: matched.length,
            hasMore: Boolean(limit && matched.length > limit),
        };
    }

    /**
     * Searches `mailbox` for candidate message UIDs matching `options`, sorted in ascending order.
     */
    async #searchUids(
        connection: ImapFlow,
        mailbox: string,
        options: ImapReadMessagesOptions | undefined,
        sinceUid: number | undefined): Promise<number[]>
    {
        const mailboxState = connection.mailbox;
        if (mailboxState) {
            const isEmpty = mailboxState.exists === 0;
            const isCaughtUp = sinceUid !== undefined && mailboxState.uidNext <= sinceUid;
            if (isEmpty || isCaughtUp)
                return [];
        }

        const query: SearchObject = {};
        if (options?.unseenOnly)
            query.seen = false;
        if (sinceUid !== undefined)
            query.uid = `${Math.max(1, sinceUid + 1)}:*`;
        if (options?.sinceDate !== undefined) {
            query.since = new Date(
                options.sinceDate.epochMilliseconds - /* 24 hours= */ 86_400_000);
        }
        if (!Object.keys(query).length)
            query.all = true;

        const result = await connection.search(query, { uid: true });
        if (result === false)
            throw new Error(`IMAP SEARCH command was rejected for mailbox "${mailbox}".`);

        // IMAP resolves `<n>:*` to `<maxUid>:<n>` when `maxUid < n`, so re-check `uid > sinceUid`.
        return (result ?? [])
            .filter(uid => sinceUid === undefined || uid > sinceUid)
            .sort((lhs, rhs) => lhs - rhs);
    }

    /**
     * Downloads all leaf MIME parts for `fetched` and assembles an `ImapMessage`.
     */
    async #downloadMessage(
        connection: ImapFlow,
        fetched: FetchMessageObject): Promise<{ message: ImapMessage; downloadedBytes: number }>
    {
        const textParts: string[] = [];
        const htmlParts: string[] = [];
        const attachments: ImapAttachment[] = [];
        let downloadedBytes = 0;

        for (const part of collectBodyParts(fetched.bodyStructure)) {
            const { content, meta } = await connection.download(fetched.uid, part.part, {
                uid: true,
                decodeText: part.kind !== 'attachment',
            });

            if (!content)
                continue;

            const buffer = await readStreamToBuffer(content);
            downloadedBytes += buffer.byteLength;

            if (part.kind === 'text') {
                textParts.push(buffer.toString('utf8'));
            } else if (part.kind === 'html') {
                htmlParts.push(buffer.toString('utf8'));
            } else {
                attachments.push({
                    filename: meta.filename ?? part.filename,
                    mimeType: (meta.contentType ?? part.mimeType).toLowerCase(),
                    bytes: new Uint8Array(buffer),
                });
            }
        }

        const envelope = fetched.envelope;
        const receivedDate = toInstant(fetched.internalDate);
        const date = toInstant(envelope?.date) ?? receivedDate;

        const message: ImapMessage = {
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

        return { message, downloadedBytes };
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
 * Returns whether `fetched` arrived at or after `sinceDate`.
 */
function isOnOrAfter(fetched: FetchMessageObject, sinceDate: Temporal.Instant): boolean {
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
 * Extracts diagnostic mailbox metadata for `integrations_logs` when a mailbox is open.
 */
function summarizeMailbox(mailbox?: MailboxObject) {
    if (!mailbox)
        return undefined;

    return {
        path: mailbox.path,
        uidValidity: mailbox.uidValidity,
        uidNext: mailbox.uidNext,
        exists: mailbox.exists,
        readOnly: mailbox.readOnly,
    };
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
