// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { default as nodemailermock } from 'nodemailer-mock';

import type { EmailLogger, EmailLoggerSeverity } from './EmailLogger';
import type { SendMessageRequest } from './SendMessageRequest';
import { EmailClient } from './EmailClient';

/**
 * Mock implementation of the MailClient that avoids using a real server.
 */
export class EmailClientMock extends EmailClient {
    #loggedExceptions: Error[] = [];
    #loggedFinalisations: (SMTPTransport.SentMessageInfo | undefined)[] = [];
    #loggedInitialisations: SendMessageRequest[] = [];
    #loggedLogMessages: any[] = [];

    constructor() {
        super({
            hostname: '127.0.0.1',
            port: 587,
            username: 'user@example.com',
            password: 'TestPassword1',
        });
    }

    /**
     * Returns the `nodemailer-mock` mock information, which allows instrumentation of the system.
     */
    get mock() { return nodemailermock.mock; }

    /**
     * Provides access to the log entries that were created during the lifetime of this instance.
     */
    get loggedExceptions() { return this.#loggedExceptions; }
    get loggedFinalisations() { return this.#loggedFinalisations; }
    get loggedInitialisations() { return this.#loggedInitialisations; }
    get loggedLogMessages() { return this.#loggedLogMessages; }

    /**
     * Overrides the default logger with an empty instance that logs to the mocked instance.
     */
    protected override createLogger(request: SendMessageRequest): EmailLogger {
        const parent = this;

        return new class implements EmailLogger {
            async initialise(request: SendMessageRequest): Promise<void> {
                parent.#loggedInitialisations.push(request);
            }
            async finalise(info?: SMTPTransport.SentMessageInfo): Promise<void> {
                parent.#loggedFinalisations.push(info);
            }
            reportException(error: Error): void {
                parent.#loggedExceptions.push(error);
            }
            reportLog(severity: EmailLoggerSeverity, ...params: any[]): void {
                parent.#loggedLogMessages.push({ severity, params });
            }
        };
    }

    /**
     * Overrides the default transport with an instance of `nodemailer-mock`, which avoids messages
     * from being send to real e-mail addresses.
     */
    protected override createTransport(options: SMTPTransport.Options) {
        return nodemailermock.createTransport(options);
    }
}
