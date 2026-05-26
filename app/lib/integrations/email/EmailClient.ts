// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { default as nodemailer, type Transporter } from 'nodemailer';

import type { User } from '@lib/auth/User';
import { EmailConnectionLogger } from './EmailConnectionLogger';
import { EmailLoggerImpl, type EmailLogger } from './EmailLogger';
import { EmailMessage } from './EmailMessage';

/**
 * Settings related to the e-mail client. An SMTP connection will be used to actually send e-mail,
 * and all messages will be stored in the "outbox" database table for tracking purposes.
 */
export interface EmailClientSettings {
    /**
     * The SMTP host to which a connection will be made.
     */
    hostname: string;

    /**
     * The SMTP port to which a connection will be made.
     */
    port: number;

    /**
     * Username using which we can sign in to the SMTP account.
     */
    username: string;

    /**
     * Password using which we can sign in to the SMTP account.
     */
    password: string;
}

/**
 * Options that can be provided when sending an e-mail.
 */
export interface SendMessageRequest {
    /**
     * The message that should be distributed. Includes the recipients.
     */
    message: EmailMessage;

    /**
     * Name of the sender. Will be completed with the e-mail address. ("John Doe")
     */
    sender: string;

    /**
     * When known, the communication ID this message should be associated with.
     */
    communicationId?: number;

    /**
     * Source user, on whose behalf the message will be sent.
     */
    sourceUser?: number | User;

    /**
     * Target user, to whom the e-mail message will be sent.
     */
    targetUser?: number | User;
}

/**
 * The e-mail client is able to send messages to volunteers' e-mail addresses across the internet.
 * Messages will be logged in their entirety, which can be accessed through the "outbox" integration
 * configuration interface in the administrative area.
 */
export class EmailClient {
    #configuration: SMTPTransport.Options;
    #connectionLogger: EmailConnectionLogger;
    #settings: EmailClientSettings;
    #transport?: Transporter<SMTPTransport.SentMessageInfo>;

    constructor(settings: EmailClientSettings) {
        this.#connectionLogger = new EmailConnectionLogger();
        this.#configuration = {
            host: settings.hostname,
            port: settings.port,
            auth: {
                user: settings.username,
                pass: settings.password,
            },
            connectionTimeout: /* 5 seconds= */ 5000,
            logger: this.#connectionLogger,
            debug: true,
        };

        this.#settings = settings;
        this.#transport = undefined;
    }

    /**
     * Convenience manner to get an instance of the EmailMessage builder.
     */
    createMessage(): EmailMessage {
        return new EmailMessage();
    }

    /**
     * Distributes the given `message` over the configured SMTP connection. Returns a promise with
     * information about the sent message when successful, or throws an exception when a failure is
     * seen. (Regardless of whether it's with the message or with the transport.)
     *
     * @param request The e-mail send request containing the message and sender.
     * @returns Information about the sent message.
     */
    async sendMessage(request: SendMessageRequest): Promise<SMTPTransport.SentMessageInfo> {
        if (!this.#transport)
            this.#transport = this.createTransport(this.#configuration);

        const logger = this.createLogger(request);
        await logger.initialise(request);

        this.#connectionLogger.setMessageLogger(logger);

        let result: SMTPTransport.SentMessageInfo | undefined;
        try {
            result = await this.#transport.sendMail({
                from: `${request.sender} <${this.#settings.username}>`,
                ...request.message.options,
            });
        } catch (error: any) {
            logger.reportException(error);
            throw error;
        } finally {
            this.#connectionLogger.setMessageLogger(undefined);
            await logger.finalise(result);
        }

        return result!;
    }

    /**
     * Safe version of `sendMessage` that will not throw an exception, but will rather return a
     * boolean that indicates thether the given `message` was sent successfully.
     *
     * @param request The e-mail send request containing the message and sender.
     * @returns A boolean that indicates whether the message was handed off to the SMTP server.
     */
    async safeSendMessage(request: SendMessageRequest): Promise<boolean> {
        try {
            await this.sendMessage(request);
            return true;

        } catch (error) {
            console.error('Unable to send an e-mail:', error);
        }

        return false;
    }

    /**
     * Verifies that the given SMTP server configuration is correct and can be used to send e-mail.
     * An exception will be thrown when the configuration is not correct.
     *
     * @returns True when everything works as expected. An exception will be thrown otherwise.
     */
    async verifyConfiguration(): Promise<true> {
        if (!this.#transport)
            this.#transport = this.createTransport(this.#configuration);

        return this.#transport.verify();
    }

    /**
     * Creates a new instance of the e-mail logger. Can be overridden for testing purposes.
     */
    protected createLogger(request: SendMessageRequest): EmailLogger {
        return new EmailLoggerImpl();
    }

    /**
     * Creates the transport over which to send e-mail using the given `options`. Can be overridden
     * for testing purposes with a mock transport implementation.
     */
    protected createTransport(options: SMTPTransport.Options) {
        return nodemailer.createTransport(options);
    }
}
