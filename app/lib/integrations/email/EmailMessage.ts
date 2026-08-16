// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { SendMailOptions } from 'nodemailer';
import { markdownToHtml } from '@components/Markdown';

/**
 * Class that encapsulates an e-mail that should be send to a specific address. The constructor
 * takes required information about the sender, after which a building pattern is enabled to create
 * the remainder of the e-mail.
 */
export class EmailMessage {
    #headers: Array<{ key: string, value: string }>;
    #options: Omit<SendMailOptions, 'from' | 'headers' | 'sender'>;

    constructor() {
        this.#headers = [];
        this.#options = {
            disableFileAccess: true,
            disableUrlAccess: true,
        };
    }

    /**
     * Gets the options for the message as they have been compiled by the builder.
     */
    get options() { return { ...this.#options, headers: this.#headers }; }

    // ---------------------------------------------------------------------------------------------
    // Information pertaining to the recipient(s) of the message.
    // ---------------------------------------------------------------------------------------------

    /**
     * Sets the `recipients` (either a string or an array of strings) as the people who should
     * receive this message on the To: line. Returns this instance of MailMessage.
     */
    setTo(recipients: string | string[]): EmailMessage {
        this.#options.to = recipients;
        return this;
    }

    /**
     * Sets the `recipients` (either a string or an array of strings) as the people who should
     * receive this message on the Cc: line. Returns this instance of MailMessage.
     */
    setCc(recipients: string | string[]): EmailMessage {
        this.#options.cc = recipients;
        return this;
    }

    /**
     * Sets the `recipients` (either a string or an array of strings) as the people who should
     * receive this message on the Bcc: line. Returns this instance of MailMessage.
     */
    setBcc(recipients: string | string[]): EmailMessage {
        this.#options.bcc = recipients;
        return this;
    }

    // ---------------------------------------------------------------------------------------------
    // Information pertaining to the metadata of the message.
    // ---------------------------------------------------------------------------------------------

    /**
     * Adds a header with the given `key` and `value` to the message. Custom headers should always
     * start with "X-" to signal the intention. Returns this instance of MailMessage.
     */
    addHeader(key: string, value: string): EmailMessage {
        this.#headers.push({ key, value });
        return this;
    }

    /**
     * Sets the subject of the message to the given `subject`. This line must appeal people to read
     * the rest of the message. Returns this instance of MailMessage.
     */
    setSubject(subject: string): EmailMessage {
        this.#options.subject = subject;
        return this;
    }

    // ---------------------------------------------------------------------------------------------
    // Information pertaining to the contents of the message.
    // ---------------------------------------------------------------------------------------------

    /**
     * Sets the HTML content of this message to the given `html` string. It is recommended to also
     * include a text version of the message. Returns this instance of MailMessage.
     */
    setHtml(html: string): EmailMessage {
        this.#options.html = html;
        return this;
    }

    /**
     * Sets the plaintext content of this message to the given `text` string. It is recommended to
     * also include an HTML version of the message. Returns this instance of MailMessage.
     */
    setText(text: string): EmailMessage {
        this.#options.text = text;
        return this;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Sets the Markdown content of this message to the given `markdown` string. Since Markdown is
     * human readable, it will also be the text version. Returns this instance of MailMessage.
     */
    async asyncSetMarkdown(markdown: string): Promise<EmailMessage> {
        this.#options.html = await markdownToHtml(markdown);

        if (!Object.hasOwn(this.#options, 'text'))
            this.#options.text = markdown;

        return this;
    }
}
