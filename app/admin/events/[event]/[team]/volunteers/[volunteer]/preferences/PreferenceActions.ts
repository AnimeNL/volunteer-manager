// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsersEvents } from '@lib/database';

import { kShirtFit, kShirtSize } from '@lib/database/Types';

// TODO: Availability preferences
// TODO: Hotel preferences

// -------------------------------------------------------------------------------------------------
// Participation preferences
// -------------------------------------------------------------------------------------------------

/**
 * Schema defining the information required to update participation preferences.
 */
const kParticipationPreferencesSchema = z.object({
    includeCreditReel: z.literal([ 0, 1 ]),
    includeSocialMedia: z.literal([ 0, 1 ]),
    tshirtFit: z.enum(kShirtFit),
    tshirtSize: z.enum(kShirtSize)
});

/**
 * Server Action through which participation preferences can be updated. Used for updates from the
 * administration area, as well as through the registration portal.
 */
export async function updateParticipationPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kParticipationPreferencesSchema, async (data, props) => {
        // TODO: Amend the authentication check for updates from the registration portal
        // TODO: Versioning of the data?

        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        const affectedRows = await db.update(tUsersEvents)
            .set({
                includeCredits: data.includeCreditReel,
                includeSocials: data.includeSocialMedia,
                shirtFit: data.tshirtFit,
                shirtSize: data.tshirtSize,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
            .executeUpdate();

        // TODO: Write a log entry

        return {
            success: true,
            message: 'Your preferences have been updated.',
        };
    });
}

// TODO: Refund preferences
// TODO: Training preferences
