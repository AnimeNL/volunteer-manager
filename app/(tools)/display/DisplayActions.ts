// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod/v4';

import { Publish } from '@lib/subscriptions';
import { executeServerAction } from '@lib/serverAction';
import { getDisplayIdFromHeaders } from '@lib/auth/DisplaySession';
import { readSettings } from '@lib/Settings';
import db, { tActivitiesLocations, tDisplays, tDisplaysRequests, tEvents } from '@lib/database';

import { kDisplayHelpRequestStatus, kDisplayHelpRequestTarget, kSubscriptionType } from '@lib/database/Types';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';

/**
 * Maps a given `DisplayHelpRequestTarget` target to a textual subject to use in a message. Use
 * generally looks like: "...requested help with [value]".
 */
const kTargetToSubject: { [k in keyof typeof kDisplayHelpRequestTarget]: string } = {
    [kDisplayHelpRequestTarget.Crew]: 'a volunteering matter',
    [kDisplayHelpRequestTarget.Nardo]: 'a Del a Rie advice query',
    [kDisplayHelpRequestTarget.Stewards]: 'a steward-related matter',
};

/**
 * Zod type that describes the data required when requesting help from a display.
 */
const kRequestHelpData = z.object({
    /**
     * To whom should the help request be directed?
     */
    target: z.enum(kDisplayHelpRequestTarget),
});

/**
 * Server Action through which displays can request help. The identified display must be a
 * provisioned display associated with a particular event. The request will be published to
 * subscribed volunteers.
 */
export async function requestHelp(formData: unknown) {
    return executeServerAction(formData, kRequestHelpData, async (data, props) => {
        if (!props.ip)
            forbidden();

        const displayId = await getDisplayIdFromHeaders(await headers());
        if (!displayId)
            forbidden();

        const dbInstance = db;
        const configuration = await dbInstance.selectFrom(tDisplays)
            .innerJoin(tActivitiesLocations)
                .on(tActivitiesLocations.locationId.equals(tDisplays.displayLocationId))
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tDisplays.displayEventId))
            .where(tDisplays.displayId.equals(displayId))
                .and(tDisplays.displayDeleted.isNull())
            .select({
                eventId: tEvents.eventId,
                label: tDisplays.displayLabel,
                location: tActivitiesLocations.locationDisplayName.valueWhenNull(
                    tActivitiesLocations.locationName),
            })
            .executeSelectNoneOrOne();

        if (!configuration)
            return { success: false, error: 'The display has not been provisioned yet' };

        const settings = await readSettings([
            'display-request-advice',
            'display-request-help',
        ]);

        if (!settings['display-request-help'])
            return { success: false, error: 'The "help request" feature is not available' };

        if (!settings['display-request-advice'] &&
                data.target === kDisplayHelpRequestTarget.Nardo) {
            return {
                success: false,
                error: 'Del a Rie Advies is currently not available for advice',
            };
        }

        if (!Object.hasOwn(kTargetToTypeId, data.target))
            return { success: false, error: 'Cannot determine what type of help is required' };

        const insertId = await dbInstance.transaction(async () => {
            const insertId = await dbInstance.insertInto(tDisplaysRequests)
                .set({
                    displayId,
                    requestEventId: configuration.eventId,
                    requestReceivedDate: dbInstance.currentZonedDateTime(),
                    requestReceivedTarget: data.target,
                })
                .returningLastInsertedId()
                .executeInsert();

            await dbInstance.update(tDisplays)
                .set({
                    displayHelpRequestStatus: kDisplayHelpRequestStatus.Pending,
                })
                .where(tDisplays.displayId.equals(displayId))
                .executeUpdate();

            return insertId;
        });

        if (!insertId)
            return { success: false, error: 'Unable to store the help request in the database' };

        await Publish({
            type: kSubscriptionType.Help,
            typeId: kTargetToTypeId[data.target],
            message: {
                requestId: insertId,
                location: configuration.label || configuration.location,
                subject: kTargetToSubject[data.target],
            },
        });

        return { success: true };

    }, /* allowVisitors= */ true);
}
