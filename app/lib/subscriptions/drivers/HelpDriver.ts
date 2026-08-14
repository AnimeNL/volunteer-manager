// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Driver, type Message, type Recipient } from '../Driver';
import { type DisplayHelpRequestTarget, kDisplayHelpRequestTarget } from '@lib/database/Types';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { SendSmsTask } from '@lib/scheduler/tasks/SendSmsTask';
import { SendWhatsappTask } from '@lib/scheduler/tasks/SendWhatsappTask';

/**
 * Converts a `DisplayHelpRequestTarget` value to a `typeId` value supported by this driver.
 */
export const kTargetToTypeId: { [k in DisplayHelpRequestTarget]: number } = {
    [kDisplayHelpRequestTarget.Crew]: 0,
    [kDisplayHelpRequestTarget.Nardo]: 1,
    [kDisplayHelpRequestTarget.Stewards]: 2
};

/**
 * Information that must be provided when publishing a help request from one of the displays.
 */
export interface HelpMessage extends Message {
    /**
     * Unique ID of the request as it has been stored in the database.
     */
    requestId: number;

    /**
     * Name of the location that has requested help.
     */
    location: string;

    /**
     * Type of help that has been requested. E.g. ("a piece of advice")
     */
    subject: string;
}

/**
 * Driver that deals with subscriptions that have the `Help` type.
 */
export class HelpDriver extends Driver<HelpMessage> {
    override async publishEmail(
        publicationId: number, recipient: Recipient, message: HelpMessage)
    {
        const template = this.getPopulatedTemplate('email', recipient, message);
        if (!template || !recipient.emailAddress)
            return false;  // not enough information to publish this message

        await SendEmailTask.Schedule({
            // note: uses the default e-mail account
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

    override async publishSms(publicationId: number, recipient: Recipient, message: HelpMessage) {
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
        publicationId: number, recipient: Recipient, message: HelpMessage)
    {
        const template = this.getPopulatedTemplate('whatsapp', recipient, message);
        if (!template || !recipient.phoneNumber)
            return false;  // not enough information to publish this message

        await SendWhatsappTask.Schedule({
            to: recipient.phoneNumber,
            contentSid: template.body,
            contentVariables: {
                '1': message.location,
                '2': message.subject,
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
