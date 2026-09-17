// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type SvgIcon from '@mui/material/SvgIcon';
import BookIcon from '@mui/icons-material/Book';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import MultipleStopIcon from '@mui/icons-material/MultipleStop';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

import { LogBuilder } from '@lib/log/index';
import { Publish, kSubscriptionType, type SubscriptionType } from '@lib/subscriptions';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';
import db, { tSubscriptions, tTeams } from '@lib/database';

/**
 * Server action that will publish a test notification to all users who have subscribed to test
 * messages.
 */
export async function publishSubscriptionTest() {
    'use server';
    return executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.integrations');

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
    'use server';
    return executeServerAction(formData, kUpdateSubscriptionsData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.subscriptions.management');

        const subscriptionTypes = await getSubscriptionTypes();

        const activeSubscriptions = await db.selectFrom(tSubscriptions)
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

        await db.transaction(async () => {
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
                        await db.deleteFrom(tSubscriptions)
                            .where(tSubscriptions.subscriptionId.equals(existing.id))
                            .executeDelete();
                    }
                } else {
                    if (existing) {
                        if (existing.channelEmail !== email || existing.channelSms !== sms ||
                                existing.channelWhatsapp !== whatsapp)
                        {
                            await db.update(tSubscriptions)
                                .set({
                                    subscriptionChannelEmail: email,
                                    subscriptionChannelSms: sms,
                                    subscriptionChannelWhatsapp: whatsapp,
                                })
                                .where(tSubscriptions.subscriptionId.equals(existing.id))
                                .executeUpdate();
                        }
                    } else {
                        await db.insertInto(tSubscriptions)
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

                await db.deleteFrom(tSubscriptions)
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

/**
 * Information that should be compiled for each subscription available in the system.
 */
export interface SubscriptionTypeInfo {
    /**
     * Unique ID of the subscription type.
     */
    id: string;

    /**
     * Type of subscription.
     */
    type: SubscriptionType;

    /**
     * ID within the type, to signal e.g. the team the application was for.
     */
    typeId: number | null;

    /**
     * Constructor for the icon used to identify this type.
     */
    Icon: typeof SvgIcon;

    /**
     * Label to display in a human readable way.
     */
    label: string;

    /**
     * Description with a slightly more elaborate explanation of what it's about.
     */
    description: string;
}

/**
 * Returns a comprehensive list of the subscription types that are available within the portal.
 */
export async function getSubscriptionTypes(): Promise<SubscriptionTypeInfo[]> {
    const teams = await db.selectFrom(tTeams)
        .select({
            id: tTeams.teamId,
            name: tTeams.teamName,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    return [
        ...teams.map(team => ({
            id: `${kSubscriptionType.Application}/${team.id}`,
            type: kSubscriptionType.Application,
            typeId: team.id,
            Icon: NewReleasesIcon,
            label: `Application for ${team.name}`,
            description: 'When a volunteer applies to help out',
        })),
        ...Object.entries(kTargetToTypeId).map(([ type, typeId ]) => ({
            id: `${kSubscriptionType.Help}/${typeId}`,
            type: kSubscriptionType.Help,
            typeId: typeId,
            Icon: HelpOutlineOutlinedIcon,
            label: `Help request for ${type}`,
            description: 'Request for help issued through our displays',
        })),
        {
            id: kSubscriptionType.Incident,
            type: kSubscriptionType.Incident,
            typeId: null,
            Icon: BookIcon,
            label: 'Duty Book incidents',
            description: 'Report of an incident through the portal',
        },
        {
            id: kSubscriptionType.Registration,
            type: kSubscriptionType.Registration,
            typeId: null,
            Icon: PersonAddIcon,
            label: 'New user registrations',
            description: 'Creation of a new user account on the portal',
        },
        {
            id: kSubscriptionType.Test,
            type: kSubscriptionType.Test,
            typeId: null,
            Icon: MultipleStopIcon,
            label: 'Internal test messages',
            description: /* none= */ '',
        },
    ];
}
