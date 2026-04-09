// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Driver, type Message, type Recipient } from '../Driver';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { SendSmsTask } from '@lib/scheduler/tasks/SendSmsTask';
import { SendWhatsappTask } from '@lib/scheduler/tasks/SendWhatsappTask';

/**
 * Information that must be provided when publishing an incident in the Duty Book.
 */
export interface IncidentMessage extends Message {
    /**
     * Full name of the author who reported the incident.
     */
    author: string;

    /**
     * AI-generated summary of the incident, briefly detailing what happened.
     */
    summary: string;

    /**
     * Unique ID of the request as it has been stored in the database.
     */
    requestId: number;
}

/**
 * Driver that deals with subscriptions that have the `Incident` type.
 */
export class IncidentDriver extends Driver<IncidentMessage> {
    override async publishEmail(
        publicationId: number, recipient: Recipient, message: IncidentMessage)
    {
        const template = this.getPopulatedTemplate('email', recipient, message);
        if (!template || !recipient.emailAddress)
            return false;  // not enough information to publish this message

        await SendEmailTask.Schedule({
            sender: 'AnimeCon Volunteering Leads',
            message: {
                to: recipient.emailAddress,
                subject: template.subject,
                markdown: template.body,
            },
            attribution: {
                sourceUserId: /* Volunteering Leads= */ 18,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }

    override async publishSms(
        publicationId: number, recipient: Recipient, message: IncidentMessage)
    {
        const template = this.getPopulatedTemplate('sms', recipient, message);
        if (!template || !recipient.phoneNumber)
            return false;  // not enough information to publish this message

        await SendSmsTask.Schedule({
            to: recipient.phoneNumber,
            message: template.body,
            attribution: {
                sourceUserId: /* Volunteering Leads= */ 18,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }

    override async publishWhatsapp(
        publicationId: number, recipient: Recipient, message: IncidentMessage)
    {
        const template = this.getPopulatedTemplate('whatsapp', recipient, message);
        if (!template || !recipient.phoneNumber)
            return false;  // not enough information to publish this message

        await SendWhatsappTask.Schedule({
            to: recipient.phoneNumber,
            contentSid: template.body,
            contentVariables: {
                '1': message.author,
                '2': message.summary,
                '3': `${message.requestId}`,
            },
            attribution: {
                sourceUserId: /* Volunteering Leads= */ 18,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }
}
