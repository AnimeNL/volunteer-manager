// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Address, AttachmentLike } from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Readable } from 'node:stream';

import type { SendMessageRequest } from './EmailClient';
import type { User } from '@lib/auth/User';
import db, { tOutboxEmail } from '@lib/database';

/**
 * Severity of messages that can be stored by the EmailLogger.
 */
export type EmailLoggerSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Interface describing the e-mail logger.
 */
export interface EmailLogger {
    /**
     * Initialises the e-mail logger. Loggers may only be initialized once.
     */
    initialise(request: SendMessageRequest): Promise<void>;

    /**
     * Finalises the logger with the `info`, obtained from the sending operation.
     */
    finalise(info?: SMTPTransport.SentMessageInfo): Promise<void>;

    /**
     * Reports an exception that happened while the e-mail was being sent.
     */
    reportException(error: Error): void;

    /**
     * Reports that a log message has been issued by the underlying library.
     */
    reportLog(severity: EmailLoggerSeverity, ...params: any[]): void;
}

/**
 * Actual implementation of the e-mail logger. Will be overridden for testing by the EmailClientMock
 * so that nothing is stored in the database.
 */
export class EmailLoggerImpl implements EmailLogger {
    #error?: Error;
    #logs: { params: any[]; severity: EmailLoggerSeverity; time: number }[];

    #startTime?: bigint;
    #insertId?: number;

    constructor() {
        this.#error = undefined;
        this.#insertId = undefined;
        this.#logs = [];
    }

    /**
     * Initialises the logger. This is called before the message will be send over SMTP, and will
     * store the message in the database, sort of as an "outbox".
     */
    async initialise(request: SendMessageRequest): Promise<void> {
        if (!!this.#insertId)
            throw new Error('E-mail loggers may only be initialised once.');

        const options = request.message.options;

        this.#startTime = process.hrtime.bigint();
        this.#insertId = await db.insertInto(tOutboxEmail)
            .set({
                outboxSender: request.sender,
                outboxSenderUserId: this.normalizeUser(request.sourceUser),
                outboxTo: this.normalizeRecipients(options.to)!,
                outboxToUserId: this.normalizeUser(request.targetUser),
                outboxCc: this.normalizeRecipients(options.cc),
                outboxBcc: this.normalizeRecipients(options.bcc),
                outboxHeaders: JSON.stringify(options.headers),
                outboxSubject: options.subject ?? '<no subject>',
                outboxBodyHtml: this.normalizeContent(options.html),
                outboxBodyText: this.normalizeContent(options.text),
            })
            .returningLastInsertedId()
            .executeInsert();
    }

    /**
     * Normalizes the User ID from the given `input`. The database only stores with IDs.
     */
    private normalizeUser(input?: User | number): number | null {
        if (typeof input === 'number')
            return input;
        else if (typeof input === 'object' && 'userId' in input)
            return input.id;

        return null;
    }

    /**
     * Normalizes the given `input` in a string that can be stored in a log.
     */
    private normalizeRecipients(input?: string | Address | Array<string | Address>): string | null {
        if (!input)
            return null;

        const inputArray = Array.isArray(input) ? input : [ input ];
        const normalizedArray = inputArray.map(individualAddress => {
            return typeof individualAddress === 'string' ? individualAddress
                                                         : individualAddress.address;
        });

        return normalizedArray.join(', ');
    }

    /**
     * Normalizes the given `input` in a string that can be stored in a log.
     */
    private normalizeContent(input?: string | Buffer | Readable | AttachmentLike): string {
        if (!input)
            return /* empty content= */ '';

        if (typeof input === 'string')
            return input;
        else if (input instanceof Buffer)
            return input.toString('utf-8');
        else if (input instanceof Readable)
            throw new Error('Unable to normalize Readable streams, not yet implemented.');

        throw new Error('Unable to normalize the e-mail content, unrecognised type.');
    }

    /**
     * Reports an exception that happened while the e-mail was being sent. We only store the error
     * for now, and will store it in the database then the `finalise` method runs.
     */
    reportException(error: Error): void {
        this.#error = error;
    }

    /**
     * Reports that a log message has been issued by the underlying e-mail framework.
     */
    reportLog(severity: EmailLoggerSeverity, ...params: any[]): void {
        if (!this.#startTime)
            throw new Error('E-mail loggers must be initialised before receiving logs');

        this.#logs.push({
            params,
            severity,
            time: Number((process.hrtime.bigint() - this.#startTime) / 1000n / 1000n),
        });
    }

    /**
     * Finalises the logger. This will write the `info` to the database entry, which will tell us
     * whether the message had been sent successfully.
     */
    async finalise(info?: SMTPTransport.SentMessageInfo): Promise<void> {
        if (!this.#insertId)
            throw new Error('E-mail loggers must be initialised before being finalised.');

        await db.update(tOutboxEmail)
            .set({
                outboxLogs: JSON.stringify(this.#logs),

                outboxErrorName: this.#error?.name,
                outboxErrorMessage: this.#error?.message,
                outboxErrorStack: this.#error?.stack,
                outboxErrorCause:
                    this.#error?.cause ? JSON.stringify(this.#error?.cause) : undefined,

                outboxResultMessageId: info?.messageId,
                outboxResultAccepted: this.normalizeRecipients(info?.accepted),
                outboxResultRejected: this.normalizeRecipients(info?.rejected),
                outboxResultPending: this.normalizeRecipients(info?.pending),
                outboxResultResponse: info?.response,
            })
            .where(tOutboxEmail.outboxEmailId.equals(this.#insertId))
            .executeUpdate();

        this.#insertId = undefined;
        this.#startTime = undefined;
    }
}
