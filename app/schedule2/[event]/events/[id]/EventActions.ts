// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';
import db, { tUsersEventsFavourites } from '@lib/database';

/**
 * Zod schema describing the data accepted by `updateEventFavourite`.
 */
const kUpdateEventFavouriteData = z.object({
    activityId: z.number().int().positive(),
    event: z.string().nonempty(),
    favourited: z.boolean(),
});

/**
 * Server Action adding or removing a program event from the signed-in volunteer's favourites.
 */
export async function updateEventFavourite(
    event: string, activityId: number, favourited: boolean)
{
    return executeServerAction(
        { activityId, event, favourited }, kUpdateEventFavouriteData, async (data, props) =>
    {
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event);

        if (data.favourited) {
            await db.insertInto(tUsersEventsFavourites)
                .set({
                    activityId: data.activityId,
                    eventId: event.id,
                    userId: props.user.id,
                })
                .onConflictDoNothing()
                .executeInsert();
        } else {
            await db.deleteFrom(tUsersEventsFavourites)
                .where(tUsersEventsFavourites.userId.equals(props.user.id))
                    .and(tUsersEventsFavourites.eventId.equals(event.id))
                    .and(tUsersEventsFavourites.activityId.equals(data.activityId))
                .executeDelete();
        }

        return {
            favourited: data.favourited,
            success: true,
        };
    });
}
