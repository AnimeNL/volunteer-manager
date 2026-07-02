// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { SubscriptionType } from '@lib/database/Types';
import { createGlobalScope } from '@app/admin/system/content/ContentScope';
import { determineEnvironment, type Environment } from '../Environment';
import db, { tContent } from '@lib/database';

/**
 * Message that is minimally needed to contextualize a message.
 */
export interface Message {}

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
     * The environment in which the driver has been created, if any.
     */
    private environment?: Environment;

    /**
     * Message templates as they have been loaded from the database.
     */
    private templates = new Map<Channel, Template>;

    /**
     * Initialises this driver by loading message templates from the database for each of the
     * supported channels. They are expected to be included as global content.
     */
    async initialise(subscriptionType: SubscriptionType): Promise<void> {
        const pathPrefix = `subscription/${subscriptionType.toLowerCase()}/`;
        const scope = createGlobalScope();

        this.environment = await determineEnvironment();

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
     * Returns an object with the substitutions that exist for the given `recipient` and `message`,
     * which will be appropriately prefixed. Given the following input:
     *
     *   `message`    { event: '2024', fullName: 'John Doe' }
     *   `recipient`  { fullName: 'Max Smith', shortName: 'Max' }
     *
     * The following list of substitutions will be composed:
     *
     *   `{environment}` animecon.team
     *   `{message.event}`: 2024
     *   `{message.fullName}`: John Doe
     *   `{recipient.fullName}`: Max Smith
     *   `{recipient.shortName}`: Max
     */
    protected getSubstitutions(recipient: Recipient, message: MessageType) {
        const substitutions: Record<string, string | number> = {
            environment: this.environment?.domain ?? 'animecon.team',
        };

        for (const [ key, value ] of Object.entries(recipient))
            substitutions[`recipient.${key}`] = value;

        for (const [ key, value ] of Object.entries(message))
            substitutions[`message.${key}`] = value;

        return substitutions;
    }

    /**
     * Returns the template for the given `channel`, if any exists, with the substitutions that
     * are enabled by `recipient` and `message` filled in.
     */
    protected getPopulatedTemplate(channel: Channel, recipient: Recipient, message: MessageType)
        : Template | undefined
    {
        const substitutions = this.getSubstitutions(recipient, message);
        const template = this.getTemplate(channel);

        if (!!template) {
            template.subject = template.subject.replace(/\\\{([a-z0-9_\.]+)\}/gi, '{$1}');
            template.body = template.body.replace(/\\\{([a-z0-9_\.]+)\}/gi, '{$1}');

            for (const [ key, value ] of Object.entries(substitutions)) {
                template.subject = template.subject.replaceAll(`{${key}}`, `${value}`);
                template.body = template.body.replaceAll(`{${key}}`, `${value}`);
            }
        }

        return template;
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
    async publishNotification(publicationId: number, recipient: Recipient, message: MessageType)
        : Promise<boolean>
    {
        // TODO: Enable a Web Push integration when there's demand for it.
        return false;
    }

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
