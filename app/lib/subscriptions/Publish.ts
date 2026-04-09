// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ApplicationMessage } from './drivers/ApplicationDriver';
import type { HelpMessage } from './drivers/HelpDriver';
import type { IncidentMessage } from './drivers/IncidentDriver';
import type { RegistrationMessage } from './drivers/RegistrationDriver';
import type { TestMessage } from './drivers/TestDriver';
import db, { tSubscriptions, tSubscriptionsPublications, tUsers } from '@lib/database';

import { kSubscriptionFactories } from './Drivers';

/**
 * Common interface describing the information necessary to execute on a publication.
 */
interface PublicationBase {
    /**
     * The user who committed an action that led to this publication.
     */
    sourceUserId?: | number;
}

/**
 * Interface describing a publication. Strongly typed based on the subscription type.
 */
export type Publication = PublicationBase & (
    { type: 'Application'; typeId: number; message: ApplicationMessage } |
    { type: 'Help'; typeId: number; message: HelpMessage } |
    { type: 'Incident', typeId?: number; message: IncidentMessage } |
    { type: 'Registration'; typeId?: undefined; message: RegistrationMessage } |
    { type: 'Test'; typeId?: undefined; message: TestMessage }
);

/**
 * Publishes the given `publication`. This will be done simultaneously across all delivery channels
 * that we support, where the actual distribution will happen asynchronously using our scheduler.
 * This method returns the unique Publication ID, in case a follow-up might be desired.
 */
export async function Publish(publication: Publication): Promise<number> {
    const dbInstance = db;
    const publicationId = await dbInstance.insertInto(tSubscriptionsPublications)
        .set({
            publicationUserId: publication.sourceUserId,
            publicationSubscriptionType: publication.type,
            publicationSubscriptionTypeId: publication.typeId,
            publicationCreated: dbInstance.currentZonedDateTime(),
        })
        .executeInsert();

    const subscriptions = await dbInstance.selectFrom(tSubscriptions)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tSubscriptions.subscriptionUserId))
        .where(tSubscriptions.subscriptionType.equals(publication.type))
            .and(tSubscriptions.subscriptionTypeId.equalsIfValue(publication.typeId))
        .select({
            user: {
                userId: tSubscriptions.subscriptionUserId,
                fullName: tUsers.displayName.valueWhenNull(
                    tUsers.firstName.concat(' ').concat(tUsers.lastName)),
                shortName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                emailAddress: tUsers.username,
                phoneNumber: tUsers.phoneNumber,
            },
            subscription: {
                channelEmail: tSubscriptions.subscriptionChannelEmail,
                channelNotification: tSubscriptions.subscriptionChannelNotification,
                channelSms: tSubscriptions.subscriptionChannelSms,
                channelWhatsapp: tSubscriptions.subscriptionChannelWhatsapp,
            },
        })
        .executeSelectMany();

    if (!subscriptions.length)
        return publicationId;

    try {
        const driver = kSubscriptionFactories[publication.type]();
        await driver.initialise(publication.type);

        const message = publication.message as any;  // |driver| is overloaded

        for (const { user, subscription } of subscriptions) {
            if (!!subscription.channelEmail)
                await driver.publishEmail(publicationId, user, message);
            if (!!subscription.channelNotification)
                await driver.publishNotification(publicationId, user, message);
            if (!!subscription.channelSms)
                await driver.publishSms(publicationId, user, message);
            if (!!subscription.channelWhatsapp)
                await driver.publishWhatsapp(publicationId, user, message);
        }
    } catch (error: any) {
        console.error(`Unable to fan out a publication (${publicationId}):`, error);
    }

    return publicationId;
}
