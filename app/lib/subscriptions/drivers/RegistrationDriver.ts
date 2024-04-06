// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Driver, type Message, type Recipient } from '../Driver';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';

/**
 * Information that must be provided when publishing a registration notification.
 */
export interface RegistrationMessage extends Message {
    /**
     * Unique ID of the user that was assigned to this registration.
     */
    userId: number;

    /**
     * Full name of the person who has registered on the Volunteer Manager.
     */
    name: string;

    /**
     * E-mail address associated with the account that they've created.
     */
    emailAddress: string;

    /**
     * IP address using which the registration has been submitted.
     */
    ip: string;
}

/**
 * Driver that deals with subscriptions that have the `Registration` type.
 */
export class RegistrationDriver extends Driver<RegistrationMessage> {
    override async publishEmail(
        publicationId: number,recipient: Recipient, message: RegistrationMessage)
    {
        const template = this.getPopulatedTemplate('email', recipient, message);
        if (!template || !recipient.emailAddress)
            return false;  // not enough information to publish this message

        await SendEmailTask.Schedule({
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

    override async publishNotification(
        publicationId: number, recipient: Recipient, message: RegistrationMessage)
    {
        // TODO: Not yet implemented.
        return false;
    }

    override async publishSms(
        publicationId: number, recipient: Recipient, message: RegistrationMessage)
    {
        // TODO: Not yet implemented.
        return false;
    }

    override async publishWhatsapp(
        publicationId: number, recipient: Recipient, message: RegistrationMessage)
    {
        // TODO: Not yet implemented.
        return false;
    }
}
