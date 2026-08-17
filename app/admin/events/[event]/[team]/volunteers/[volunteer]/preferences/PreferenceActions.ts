// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsersEventsPreferencesParticipation } from '@lib/database';

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

        const { event } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        const dbInstance = db;
        const updated = await dbInstance.transaction(async () => {
            const existing = await dbInstance.selectFrom(tUsersEventsPreferencesParticipation)
                .where(tUsersEventsPreferencesParticipation.userId.equals(userId))
                    .and(tUsersEventsPreferencesParticipation.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
                .select({
                    includeCreditReel:
                        tUsersEventsPreferencesParticipation.participationIncludeCreditReel,
                    includeSocialMedia:
                        tUsersEventsPreferencesParticipation.participationIncludeSocialMedia,
                    tshirtFit: tUsersEventsPreferencesParticipation.participationTshirtFit,
                    tshirtSize: tUsersEventsPreferencesParticipation.participationTshirtSize,
                })
                .executeSelectNoneOrOne();

            if (existing) {
                if (existing.includeCreditReel !== data.includeCreditReel ||
                    existing.includeSocialMedia !== data.includeSocialMedia ||
                    existing.tshirtFit !== data.tshirtFit ||
                    existing.tshirtSize !== data.tshirtSize)
                {
                    return false;  // no updates
                }
            }

            await dbInstance.update(tUsersEventsPreferencesParticipation)
                .set({
                    preferenceVersionIsLatest: 0,
                })
                .where(tUsersEventsPreferencesParticipation.userId.equals(userId))
                    .and(tUsersEventsPreferencesParticipation.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
                .executeUpdate();

            await dbInstance.insertInto(tUsersEventsPreferencesParticipation)
                .set({
                    userId,
                    eventId: event.id,
                    preferenceVersion: dbInstance.currentZonedDateTime(),
                    preferenceVersionIsLatest: /* true= */ 1,
                    preferenceVersionUserId: props.user.id,
                    participationIncludeCreditReel: data.includeCreditReel,
                    participationIncludeSocialMedia: data.includeSocialMedia,
                    participationTshirtFit: data.tshirtFit,
                    participationTshirtSize: data.tshirtSize,
                })
                .executeInsert();

            return true;
        });

        LogBuilder.for('UpdateParticipationPreferences')
            .withCondition(updated)
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
            });

        return {
            success: true,
            message: 'Your preferences have been updated.',
        };
    });
}

// TODO: Refund preferences
// TODO: Training preferences
