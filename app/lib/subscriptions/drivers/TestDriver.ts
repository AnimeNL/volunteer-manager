// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Driver, type Message, type Recipient } from '../Driver';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { SendSmsTask } from '@lib/scheduler/tasks/SendSmsTask';
import { SendWhatsappTask } from '@lib/scheduler/tasks/SendWhatsappTask';

/**
 * Information that must be provided when publishing a test notification.
 */
export interface TestMessage extends Message {
    /**
     * Unique ID of the user who sent the test message.
     */
    userId: number;

    /**
     * Name of the user who sent the test message.
     */
    name: string;
}

/**
 * Driver that deals with subscriptions that have the `Test` type.
 */
export class TestDriver extends Driver<TestMessage> {
    override async publishEmail(
        publicationId: number, recipient: Recipient, message: TestMessage)
    {
        const template = this.getPopulatedTemplate('email', recipient, message);
        if (!template || !recipient.emailAddress)
            return false;  // not enough information to publish this message

        await SendEmailTask.Schedule({
            // note: uses the default e-mail account
            sender: 'AnimeCon Volunteering Teams',
            message: {
                to: recipient.emailAddress,
                subject: template.subject,
                markdown: template.body,
            },
            attribution: {
                sourceUserId: message.userId,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }

    override async publishSms(
        publicationId: number, recipient: Recipient, message: TestMessage)
    {
        const template = this.getPopulatedTemplate('sms', recipient, message);
        if (!template || !recipient.phoneNumber)
            return false;  // not enough information to publish this message

        await SendSmsTask.Schedule({
            to: recipient.phoneNumber,
            message: template.body,
            attribution: {
                sourceUserId: message.userId,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }

    override async publishWhatsapp(
        publicationId: number, recipient: Recipient, message: TestMessage)
    {
        const template = this.getPopulatedTemplate('whatsapp', recipient, message);
        if (!template || !recipient.phoneNumber)
            return false;  // not enough information to publish this message

        await SendWhatsappTask.Schedule({
            to: recipient.phoneNumber,
            contentSid: template.body,
            contentVariables: {
                '1': message.name,
            },
            attribution: {
                sourceUserId: message.userId,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }
}
