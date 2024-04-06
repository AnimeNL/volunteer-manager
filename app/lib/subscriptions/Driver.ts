// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { SubscriptionType } from '@lib/database/Types';
import { createGlobalScope } from '@app/admin/content/ContentScope';
import db, { tContent } from '@lib/database';

/**
 * Message that is minimally needed to contextualize a message.
 */
export interface Message {
    // TODO: Add shared context.
}

/**
 * Recipient that will be receiving a message.
 */
export interface Recipient {
    // ---------------------------------------------------------------------------------------------
    // Information regarding who the recipient is:
    // ---------------------------------------------------------------------------------------------

    /**
     * User to whom the message is due to be delivered.
     */
    userId: number;

    /**
     * Full name of the user - either their display name, or their full name.
     */
    fullName: string;

    /**
     * Short name of the user - either their display name, or their first name.
     */
    shortName: string;

    // ---------------------------------------------------------------------------------------------
    // Information regarding how to reach the recipient:
    // ---------------------------------------------------------------------------------------------

    /**
     * E-mail address that the message should be delivered to.
     */
    emailAddress?: string;

    /**
     * Phone number that the message should be delivered to.
     */
    phoneNumber?: string;
}

/**
 * Message channels that are supported by drivers.
 */
type Channel = 'email' | 'notification' | 'sms' | 'whatsapp';

/**
 * Template for a message describing how it should be explained to users.
 */
type Template = {
    subject: string;
    body: string;
};

/**
 * Interface describing the behaviour we expect from a subscription driver.
 */
export abstract class Driver<MessageType extends Message> {
    /**
     * Message templates
     */
    private templates = new Map<Channel, Template>;

    /**
     * Initialises this driver by loading message templates from the database for each of the
     * supported channels. They are expected to be included as global content.
     */
    async initialise(subscriptionType: SubscriptionType): Promise<void> {
        const pathPrefix = `subscription/${subscriptionType.toLowerCase()}/`;
        const scope = createGlobalScope();

        const content = await db.selectFrom(tContent)
            .where(tContent.eventId.equals(scope.eventId))
                .and(tContent.teamId.equals(scope.teamId))
                .and(tContent.contentType.equals(scope.type))
                .and(tContent.contentPath.startsWith(pathPrefix))
            .select({
                type: tContent.contentPath.substrToEnd(pathPrefix.length),
                subject: tContent.contentTitle,
                body: tContent.content,
            })
            .executeSelectMany();

        for (const { type, subject, body } of content) {
            switch (type) {
                case 'email':
                case 'notification':
                case 'sms':
                case 'whatsapp':
                    this.templates.set(type, { subject, body });
                    break;

                default:
                    console.warn(`Invalid content type found for ${subscriptionType}: ${type}`);
                    break;
            }
        }
    }

    /**
     * Returns the template for the given `channel`, if any exists. Not having a template most
     * likely means that no message will be able to be distributed.
     */
    protected getTemplate(channel: Channel): Template | undefined {
        return this.templates.get(channel);
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Publishes the given `message` to the given `recipient` as an e-mail.
     */
    abstract publishEmail(publicationId: number, recipient: Recipient, message: MessageType)
        : Promise<boolean>;

    /**
     * Publishes the given `message` to the given `recipient` as an notification.
     */
    abstract publishNotification(publicationId: number, recipient: Recipient, message: MessageType)
        : Promise<boolean>;

    /**
     * Publishes the given `message` to the given `recipient` as an SMS message.
     */
    abstract publishSms(publicationId: number, recipient: Recipient, message: MessageType)
        : Promise<boolean>;

    /**
     * Publishes the given `message` to the given `recipient` over WhatsApp.
     */
    abstract publishWhatsapp(publicationId: number, recipient: Recipient, message: MessageType)
        : Promise<boolean>;
}
