// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Logger } from 'nodemailer/lib/shared';
import type { EmailLogger } from './EmailLogger';

/**
 * The e-mail connection logger takes messages from nodemailer and proxies them to the EmailLogger
 * instance when set. All log statements will be stored with in the outbox database table.
 */
export class EmailConnectionLogger implements Logger {
    #messageLogger: EmailLogger | undefined = undefined;

    /**
     * Sets the local message logger to `messageLogger`. All received log statements will be sent
     * to that logger instead, to be stored in a message-associated manner.
     */
    setMessageLogger(messageLogger?: EmailLogger): void {
        this.#messageLogger = messageLogger;
    }

    // ---------------------------------------------------------------------------------------------
    // Logger implementation:
    // ---------------------------------------------------------------------------------------------

    trace(...params: any[]): void {
        this.#messageLogger?.reportLog('trace', params);
    }
    debug(...params: any[]): void {
        this.#messageLogger?.reportLog('debug', params);
    }
    info(...params: any[]): void {
        this.#messageLogger?.reportLog('info', params);
    }
    warn(...params: any[]): void {
        this.#messageLogger?.reportLog('warn', params);
    }
    error(...params: any[]): void {
        this.#messageLogger?.reportLog('error', params);
    }
    fatal(...params: any[]): void {
        this.#messageLogger?.reportLog('fatal', params);
    }

}

