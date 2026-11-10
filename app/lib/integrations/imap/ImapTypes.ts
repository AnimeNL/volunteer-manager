// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Options controlling which messages `ImapClient.readMessages()` selects and how mailbox state is
 * handled.
 */
export interface ImapReadMessagesOptions {
    /**
     * Path of the mailbox to open.
     * @default "INBOX"
     */
    mailbox?: string;

    /**
     * Whether to restrict results to messages that do not have the `\Seen` flag set.
     */
    unseenOnly?: boolean;

    /**
     * Expected `UIDVALIDITY` value of the mailbox for `sinceUid`. When provided and the server
     * reports a different `UIDVALIDITY`, `sinceUid` is ignored so synchronization restarts from
     * UID `1` under the new `UIDVALIDITY`.
     */
    uidValidity?: bigint;

    /**
     * Exclusive lower UID bound: only messages with `uid > sinceUid` will be returned.
     */
    sinceUid?: number;

    /**
     * Inclusive lower bound on the server arrival timestamp (`INTERNALDATE`) of messages to return.
     */
    sinceDate?: Temporal.Instant;

    /**
     * Maximum number of messages to download and return, ordered by ascending `uid`.
     */
    limit?: number;

    /**
     * Whether returned messages should have the `\Seen` flag added once read. When `false` or
     * omitted, the mailbox is opened in read-only mode so server flags remain untouched.
     * @default false
     */
    markAsSeen?: boolean;
}

/**
 * Result returned by `ImapClient.readMessages()`, pairing mailbox sync metadata with the downloaded
 * messages.
 */
export interface ImapReadMessagesResult {
    /**
     * `UIDVALIDITY` reported by the server for the opened mailbox, when available.
     */
    uidValidity?: bigint;

    /**
     * Whether the server's `UIDVALIDITY` differed from `options.uidValidity`.
     */
    uidValidityReset: boolean;

    /**
     * Whether additional matching messages remain in the mailbox beyond `options.limit`.
     */
    hasMore: boolean;

    /**
     * Retrieved messages, ordered by ascending `uid`.
     */
    messages: ImapMessage[];
}

/**
 * Represents a parsed e-mail participant (sender or recipient) from a message envelope.
 */
export interface ImapAddress {
    /**
     * Display name of the participant, when present.
     */
    name?: string;

    /**
     * E-mail address of the participant.
     */
    address: string;
}

/**
 * Represents a decoded attachment extracted from an IMAP message.
 */
export interface ImapAttachment {
    /**
     * Filename of the attachment, when advertised in `Content-Disposition` or `Content-Type`.
     */
    filename?: string;

    /**
     * Lowercased IANA MIME type of the attachment (e.g. `"application/pdf"`).
     */
    mimeType: string;

    /**
     * Decoded raw bytes of the attachment.
     */
    bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Represents an inbound e-mail message retrieved from an IMAP mailbox.
 */
export interface ImapMessage {
    /**
     * Mailbox-scoped unique identifier (UID) of the message.
     */
    uid: number;

    /**
     * Globally unique `Message-ID` header value, when present.
     */
    messageId?: string;

    /**
     * `In-Reply-To` header value referencing a parent `Message-ID`, when present.
     */
    inReplyTo?: string;

    /**
     * Timestamp of the message derived from the envelope `Date` header, falling back to
     * `receivedDate` when missing or unparseable.
     */
    date?: Temporal.Instant;

    /**
     * Timestamp at which the IMAP server received the message (`INTERNALDATE`), when reported.
     */
    receivedDate?: Temporal.Instant;

    /**
     * Addresses listed in the `From` header.
     */
    from: ImapAddress[];

    /**
     * Addresses listed in the `To` header.
     */
    to: ImapAddress[];

    /**
     * Addresses listed in the `Cc` header.
     */
    cc: ImapAddress[];

    /**
     * Addresses listed in the `Reply-To` header.
     */
    replyTo: ImapAddress[];

    /**
     * Decoded subject line of the message, when present.
     */
    subject?: string;

    /**
     * IMAP flags set on the message when fetched (e.g. `"\\Seen"`, `"\\Answered"`).
     */
    flags: string[];

    /**
     * Decoded UTF-8 plain-text body of the message, when present.
     */
    text?: string;

    /**
     * Decoded UTF-8 HTML body of the message, when present.
     */
    html?: string;

    /**
     * Decoded attachments included with the message.
     */
    attachments: ImapAttachment[];
}
