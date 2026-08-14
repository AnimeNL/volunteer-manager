// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Driver, type Message, type Recipient } from '../Driver';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { SendSmsTask } from '@lib/scheduler/tasks/SendSmsTask';
import { SendWhatsappTask } from '@lib/scheduler/tasks/SendWhatsappTask';

/**
 * Information that must be provided when publishing an application notification.
 */
export interface ApplicationMessage extends Message {
    /**
     * User ID of the volunteer who applied to help out.
     */
    userId: number;

    /**
     * Full name of the person who has applied to help out in an event.
     */
    name: string;

    /**
     * Short name of the event in which they have asked to participate.
     */
    event: string;

    /**
     * URL-safe slug of the event in which they have asked to participate.
     */
    eventSlug: string;

    /**
     * Environment of the team in which they would like to help out.
     */
    teamEnvironment: string;

    /**
     * Name of the team that the volunteer has asked to help out with. ("Stewards")
     */
    teamName: string;

    /**
     * URL-safe slug of the team in which they have asked to participate.
     */
    teamSlug: string;

    /**
     * Title of the team in which they would like to help out. ("Steward Team")
     */
    teamTitle: string;
}

/**
 * Driver that deals with subscriptions that have the `Application` type.
 */
export class ApplicationDriver extends Driver<ApplicationMessage> {
    override async publishEmail(
        publicationId: number, recipient: Recipient, message: ApplicationMessage)
    {
        const template = this.getPopulatedTemplate('email', recipient, message);
        if (!template || !recipient.emailAddress)
            return false;  // not enough information to publish this message

        await SendEmailTask.Schedule({
            // note: uses the default e-mail account
            sender: `AnimeCon ${message.teamTitle}`,
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
        publicationId: number, recipient: Recipient, message: ApplicationMessage)
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
        publicationId: number, recipient: Recipient, message: ApplicationMessage)
    {
        const template = this.getPopulatedTemplate('whatsapp', recipient, message);
        if (!template || !recipient.phoneNumber)
            return false;  // not enough information to publish this message

        await SendWhatsappTask.Schedule({
            to: recipient.phoneNumber,
            contentSid: template.body,
            contentVariables: {
                '1': message.name,
                '2': message.teamTitle,
                '3': `${message.eventSlug}/${message.teamSlug}/applications`,
            },
            attribution: {
                sourceUserId: message.userId,
                targetUserId: recipient.userId,
            },
        });

        return true;
    }
}
