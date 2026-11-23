// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log';
import { Publish } from '@lib/subscriptions';
import { executeServerAction } from '@lib/serverAction';
import { getSubscriptionTypes } from './getSubscriptionTypes';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tSubscriptions } from '@lib/database';

import { kSubscriptionType } from '@lib/subscriptions';

/**
 * Server action that will publish a test notification to all users who have subscribed to test
 * messages.
 */
export async function publishSubscriptionTest() {
    return executeServerAction({}, z.object({ /* none */ }), async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        await Publish({
            type: kSubscriptionType.Test,
            sourceUserId: props.user.id,
            message: {
                userId: props.user.id,
                name: props.user.nameOrFirstName,
            },
        });

        LogBuilder.for('PublishSubscriptionTest')
            .withInitiatorUser(props.user)
            .withSeverity('Debug')
            .record();
    });
}

/**
 * Subscription data is a key/value mapping of active subscriptions.
 */
const kUpdateSubscriptionsData = z.looseObject({ /* freeform */ });

/**
 * Server Action through which subscriptions can be updated. This action executes a diffing
 * operation to align the database with the submitted configuration. Subscriptions that are no
 * longer recognised (because they e.g. have been removed) will be silently removed.
 */
export async function updateSubscriptions(userId: number, formData: unknown) {
    return executeServerAction(formData, kUpdateSubscriptionsData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.subscriptions.management');

        const subscriptionTypes = await getSubscriptionTypes();

        const dbInstance = db;
        const activeSubscriptions = await dbInstance.selectFrom(tSubscriptions)
            .where(tSubscriptions.subscriptionUserId.equals(userId))
            .select({
                id: tSubscriptions.subscriptionId,
                type: tSubscriptions.subscriptionType,
                typeId: tSubscriptions.subscriptionTypeId,
                channelEmail: tSubscriptions.subscriptionChannelEmail,
                channelSms: tSubscriptions.subscriptionChannelSms,
                channelWhatsapp: tSubscriptions.subscriptionChannelWhatsapp,
            })
            .executeSelectMany();

        await dbInstance.transaction(async () => {
            const consultedActiveSubscriptions: Set<number> = new Set();

            for (const subscriptionType of subscriptionTypes) {
                let channels: string[] = [ /* none */ ];
                if (Object.hasOwn(data, subscriptionType.id))
                    channels = data[subscriptionType.id] as string[];

                const email = channels.includes('email') ? 1 : 0;
                const sms = channels.includes('sms') ? 1 : 0;
                const whatsapp = channels.includes('whatsapp') ? 1 : 0;

                const existing = activeSubscriptions.find(subscription => {
                    return subscription.type === subscriptionType.type &&
                           subscription.typeId === (subscriptionType.typeId ?? undefined);
                });

                if (existing)
                    consultedActiveSubscriptions.add(existing.id);

                if (email === 0 && sms === 0 && whatsapp === 0) {
                    if (existing) {
                        await dbInstance.deleteFrom(tSubscriptions)
                            .where(tSubscriptions.subscriptionId.equals(existing.id))
                            .executeDelete();
                    }
                } else {
                    if (existing) {
                        if (existing.channelEmail !== email || existing.channelSms !== sms ||
                                existing.channelWhatsapp !== whatsapp)
                        {
                            await dbInstance.update(tSubscriptions)
                                .set({
                                    subscriptionChannelEmail: email,
                                    subscriptionChannelSms: sms,
                                    subscriptionChannelWhatsapp: whatsapp,
                                })
                                .where(tSubscriptions.subscriptionId.equals(existing.id))
                                .executeUpdate();
                        }
                    } else {
                        await dbInstance.insertInto(tSubscriptions)
                            .set({
                                subscriptionUserId: userId,
                                subscriptionType: subscriptionType.type,
                                subscriptionTypeId: subscriptionType.typeId,
                                subscriptionChannelEmail: email,
                                subscriptionChannelNotification: 0,
                                subscriptionChannelSms: sms,
                                subscriptionChannelWhatsapp: whatsapp,
                            })
                            .executeInsert();
                    }
                }
            }

            for (const subscription of activeSubscriptions) {
                if (consultedActiveSubscriptions.has(subscription.id))
                    continue;

                await dbInstance.deleteFrom(tSubscriptions)
                    .where(tSubscriptions.subscriptionId.equals(subscription.id))
                    .executeDelete();
            }
        });

        LogBuilder.for('UpdateAccountSubscriptions')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record();

        return { success: true };
    });
}
