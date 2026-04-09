// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { queryUsersWithPermission } from '@lib/auth/AccessQuery';
import db, { tSubscriptions, tTeams, tUsers } from '@lib/database';

import { kSubscriptionType } from '@lib/database/Types';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';

/**
 * Row model for a subscription.
 */
const kSubscriptionRowModel = z.object({
    /**
     * Unique ID of the subscription row, referring to its representation in the database.
     */
    id: z.number(),

    /**
     * Path towards this subscription, used to power the tree view in the user interface.
     */
    path: z.string(),

    /**
     * Name of the volunteer who can have subscriptions.
     */
    name: z.string(),

    /**
     * Type of subscription that this row is dealing with.
     */
    type: z.enum(kSubscriptionType).optional(),

    /**
     * Whether notifications for this subscription will be delivered by e-mail.
     */
    channelEmail: z.boolean().optional(),

    /**
     * Whether notifications for this subscription will be delivered as a Web Push Notification.
     */
    channelNotification: z.boolean().optional(),

    /**
     * Whether notifications for this subscription will be delivered as a SMS message.
     */
    channelSms: z.boolean().optional(),

    /**
     * Whether notifications for this subscription will be delivered using WhatsApp.
     */
    channelWhatsapp: z.boolean().optional(),

    /**
     * Total subscription count for this volunteer.
     */
    subscriptionCount: z.number().optional(),
});

/**
 * The subscription API does not require any context.
 */
const kSubscriptionContext = z.never();

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type SubscriptionsEndpoints =
    DataTableEndpoints<typeof kSubscriptionRowModel, typeof kSubscriptionContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type SubscriptionsRowModel = z.infer<typeof kSubscriptionRowModel>;

/**
 * Returns a comprehensive list of the subscription types that are available within the portal.
 */
async function getSubscriptionTypes() {
    const teams = await db.selectFrom(tTeams)
        .select({
            id: tTeams.teamId,
            name: tTeams.teamName,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    return [
        ...teams.map(team => ({
            type: kSubscriptionType.Application,
            typeId: team.id,
            label: `Application (${team.name})`,
        })),
        ...Object.entries(kTargetToTypeId).map(([ type, typeId ]) => ({
            type: kSubscriptionType.Help,
            typeId: typeId,
            label: `Help request (${type})`,
        })),
        { type: kSubscriptionType.Incident, typeId: null, label: 'Duty Book incidents' },
        { type: kSubscriptionType.Registration, typeId: null, label: 'New user registrations' },
        { type: kSubscriptionType.Test, typeId: null, label: 'Test messages' },
    ];
}

/**
 * The Subscription API is implemented as a regular, editable DataTable API. All operations are only
 * available to people with the subscription management permissions.
 */
export const { GET, PUT } =
createDataTableApi(kSubscriptionRowModel, kSubscriptionContext, {
    accessCheck(request, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.subscriptions.management',
        });
    },

    async list(context, props) {
        const subscriptionTypes = await getSubscriptionTypes();
        const subscriptionsJoin = tSubscriptions.forUseInLeftJoin();

        const eligibleUsers = await queryUsersWithPermission('system.subscriptions.eligible');
        const eligibleUserIds = eligibleUsers.map(user => user.id);

        const dbInstance = db;
        const volunteers = await dbInstance.selectFrom(tUsers)
            .leftJoin(subscriptionsJoin)
                .on(subscriptionsJoin.subscriptionUserId.equals(tUsers.userId))
            .where(tUsers.userId.in(eligibleUserIds))
            .select({
                id: tUsers.userId,
                name: tUsers.name,

                subscriptions: dbInstance.aggregateAsArray({
                    id: subscriptionsJoin.subscriptionId,
                    type: subscriptionsJoin.subscriptionType,
                    typeId: subscriptionsJoin.subscriptionTypeId,
                    channelEmail: subscriptionsJoin.subscriptionChannelEmail,
                    channelNotification: subscriptionsJoin.subscriptionChannelNotification,
                    channelSms: subscriptionsJoin.subscriptionChannelSms,
                    channelWhatsapp: subscriptionsJoin.subscriptionChannelWhatsapp,
                }),
            })
            .groupBy(tUsers.userId)
            .orderBy('name', 'asc')
            .executeSelectMany();

        const subscriptions: SubscriptionsRowModel[] = [];
        for (const volunteer of volunteers) {
            subscriptions.push({
                id: volunteer.id,
                path: `${volunteer.id}`,
                name: volunteer.name,
                subscriptionCount: volunteer.subscriptions.length,
            });

            let subscriptionIndex = 0;
            for (const { type, typeId, label } of subscriptionTypes) {
                let channelEmail: boolean = false;
                let channelNotification: boolean = false;
                let channelSms: boolean = false;
                let channelWhatsapp: boolean = false;

                for (const subscription of volunteer.subscriptions) {
                    if (subscription.type !== type)
                        continue;  // irrelevant subscription
                    if (subscription.typeId !== typeId) {
                        if (subscription.typeId !== undefined && typeId !== null)
                            continue;  // irrelevant subscription
                    }

                    channelEmail ||= !!subscription.channelEmail;
                    channelNotification ||= !!subscription.channelNotification;
                    channelSms ||= !!subscription.channelSms;
                    channelWhatsapp ||= !!subscription.channelWhatsapp;
                }

                subscriptions.push({
                    id: volunteer.id * 10_000 + (subscriptionIndex++),
                    path: `${volunteer.id}/${type}-${typeId}`,
                    name: label,
                    type: type,
                    channelEmail,
                    channelNotification,
                    channelSms,
                    channelWhatsapp,
                });
            }
        }

        return {
            success: true,
            rowCount: subscriptions.length,
            rows: subscriptions,
        };
    },

    async update({ row }) {
        const matches = row.path.match(/^(\d+)\/([^\-]+)\-(.+?)$/);
        if (!matches)
            notFound();

        const dbInstance = db;

        // (1) Parse the incoming data given the path included in the `row`.
        const userId = z.coerce.number().parse(matches[1]);
        const type = z.enum(kSubscriptionType).parse(matches[2]);
        const typeId = matches[3] === 'null' ? null
                                             : z.coerce.number().parse(matches[3]);

        // (2) Delete any existing subscription for that user, and create a new one.
        await dbInstance.transaction(async () => {
            await dbInstance.deleteFrom(tSubscriptions)
                .where(tSubscriptions.subscriptionUserId.equals(userId))
                    .and(tSubscriptions.subscriptionType.equals(type))
                    .and(tSubscriptions.subscriptionTypeId.equalsIfValue(typeId))
                .executeDelete();

            if (!row.channelEmail && !row.channelNotification && !row.channelSms &&
                    !row.channelWhatsapp) {
                return;  // no need to create a new subscription
            }

            await dbInstance.insertInto(tSubscriptions)
                .set({
                    subscriptionUserId: userId,
                    subscriptionType: type,
                    subscriptionTypeId: typeId,
                    subscriptionChannelEmail: row.channelEmail ? 1 : 0,
                    subscriptionChannelNotification: row.channelNotification ? 1 : 0,
                    subscriptionChannelSms: row.channelSms ? 1 : 0,
                    subscriptionChannelWhatsapp: row.channelWhatsapp ? 1 : 0,
                })
                .executeInsert();
        });

        return { success: true };
    },

    async writeLog({ id }, mutation, props) {
        if (mutation !== 'Updated')
            return;

        const targetUser = Math.floor(id / 10_000);

        RecordLog({
            type: kLogType.AdminSubscriptionUpdate,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser,
        });
    },
});
