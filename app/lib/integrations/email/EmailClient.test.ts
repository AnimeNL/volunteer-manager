// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { setImmediate } from 'node:timers';

import { EmailClientMock } from './EmailClientMock';
import { EmailMessage } from './EmailMessage';

global.setImmediate = setImmediate;

describe('EmailClient', () => {
    it('it is able to verify connections while using the mock', async () => {
        const client = new EmailClientMock();
        client.mock.setMockedVerify(true);

        const result = await client.verifyConfiguration();
        expect(result).toBeTruthy();
    });

    it('is able to build messages using a builder pattern', async () => {
        const message = new EmailMessage()
            .setTo('user@example.com')
            .setCc('another@example.com')
            .setBcc([ 'foo@bar.com', 'baz@qux.com' ])
            .addHeader('X-Foo', 'Bar')
            .addHeader('X-Baz', 'Qux')
            .setSubject('This is a test')
            .setHtml('<b>Hello, world!</b>')
            .setText('Hello, world!');

        expect(message.options).toEqual({
            // Defaults:
            disableFileAccess: true,
            disableUrlAccess: true,

            // Configuration:
            to: 'user@example.com',
            cc: 'another@example.com',
            bcc: [ 'foo@bar.com', 'baz@qux.com' ],
            headers: [
                { key: 'X-Foo', value: 'Bar' },
                { key: 'X-Baz', value: 'Qux' },
            ],
            subject: 'This is a test',
            html: '<b>Hello, world!</b>',
            text: 'Hello, world!',
        });

        const client = new EmailClientMock();
        const info = await client.sendMessage({ sender: 'My Name', message });
        expect(info.messageId.length).toBeGreaterThan(16);

        const [ sentMessage ] = client.mock.getSentMail();
        expect(sentMessage).toEqual({
            from: 'My Name <user@example.com>',
            ...message.options,
        });
    });

    it('is able to build messages using markdown', () => {
        const message = new EmailMessage().setMarkdown('**Hello** world!');
        expect(message.options).toEqual({
            // Defaults:
            disableFileAccess: true,
            disableUrlAccess: true,
            headers: [],

            // Configuration:
            html: '<p><strong>Hello</strong> world!</p>\n',
            text: '**Hello** world!',
        });
    });

    it('is able to catch exceptions that occur when sending a message', async () => {
        const message = new EmailMessage()
            .setTo('user@example.com')
            .setSubject('This is a test')
            .setText('Hello, world!');

        const client = new EmailClientMock();
        client.mock.setShouldFailOnce(true);

        expect(client.loggedInitialisations).toHaveLength(0);
        expect(client.loggedExceptions).toHaveLength(0);
        expect(client.loggedFinalisations).toHaveLength(0);

        let info: SMTPTransport.SentMessageInfo | undefined = undefined;
        try {
            info = await client.sendMessage({ sender: 'My Name', message });
        } catch (error: any) {
            expect(error.message).toEqual('nodemailer-mock failure');
        }

        expect(info).toBeUndefined();

        expect(client.loggedInitialisations).toHaveLength(1);
        expect(client.loggedExceptions).toHaveLength(1);
        expect(client.loggedFinalisations).toHaveLength(1);
    });
});
