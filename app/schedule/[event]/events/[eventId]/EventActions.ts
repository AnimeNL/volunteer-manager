// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { FavouriteCache } from '@app/api/event/schedule/FavouriteCache';
import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsersEventsFavourites } from '@lib/database';

/**
 * Zod type that describes the data required when updating a volunteer's favourite status for an
 * activity.
 */
const kUpdateFavouriteData = z.object({
    /**
     * Unique slug of the event to which the activity belongs.
     */
    event: z.string().nonempty(),

    /**
     * Unique ID of the activity whose favourited status should be updated.
     */
    activityId: z.string().nonempty(),
});

/**
 * Server Action through which a volunteer is able to update their favourite events.
 */
export async function updateFavourite(formData: unknown) {
    return executeServerAction(formData, kUpdateFavouriteData, async (data, props) => {
        const { event } =
            await requireVolunteerAuthenticationWithEvent(props.authenticationContext, data.event);

        const activityId = parseInt(data.activityId, /* radix= */ 10);
        if (!Number.isSafeInteger(activityId))
            notFound();

        const dbInstance = db;
        const activities = await FavouriteCache.read(dbInstance, event.id, props.user.id);

        let favourited: boolean;
        if (Object.hasOwn(activities, data.activityId)) {
            await dbInstance.deleteFrom(tUsersEventsFavourites)
                .where(tUsersEventsFavourites.userId.equals(props.user.id))
                    .and(tUsersEventsFavourites.eventId.equals(event.id))
                    .and(tUsersEventsFavourites.activityId.equals(activityId))
                .executeDelete();

            favourited = false;
        } else {
            await dbInstance.insertInto(tUsersEventsFavourites)
                .set({
                    userId: props.user.id,
                    eventId: event.id,
                    activityId,
                })
                .onConflictDoNothing()
                .executeInsert();

            favourited = true;
        }

        FavouriteCache.clear(event.id, props.user.id);

        return {
            success: true,
            favourited,
        };
    });
}
