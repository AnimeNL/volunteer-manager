// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsersEventsPreferencesHotel, tUsersEventsPreferencesParticipation, tUsersEventsPreferencesTraining } from '@lib/database';

import { kShirtFit, kShirtSize } from '@lib/database/Types';
import { kTemporalPlainDate } from '@app/api/Types';

// -------------------------------------------------------------------------------------------------
// Availability preferences
// -------------------------------------------------------------------------------------------------

// TODO: Availability preferences

// -------------------------------------------------------------------------------------------------
// Hotel preferences
// -------------------------------------------------------------------------------------------------

/**
 * Schema defining the information required to update hotel preferences.
 */
const kHotelPreferencesSchema = z.object({
    interested: z.literal(0),
}).or(z.object({
    interested: z.literal(1),
    roomId: z.number(),
    occupants: z.number(),
    preferences: z.string(),
    checkIn: kTemporalPlainDate,
    checkOut: kTemporalPlainDate,
}));

/**
 * Server Action through which hotel preferences can be updated. Used for updates from the
 * administration area, as well as through the registration portal.
 */
export async function updateHotelPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kHotelPreferencesSchema, async (data, props) => {
        // TODO: Amend the authentication check for updates from the registration portal

        const { event } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.hotels',
                scope: { event: eventSlug }
            });


        const dbInstance = db;
        const updated = await dbInstance.transaction(async () => {
            const existing = await dbInstance.selectFrom(tUsersEventsPreferencesHotel)
                .where(tUsersEventsPreferencesHotel.userId.equals(userId))
                    .and(tUsersEventsPreferencesHotel.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesHotel.preferenceVersionIsLatest.equals(1))
                .select({
                    interested: tUsersEventsPreferencesHotel.hotelInterested,
                    roomId: tUsersEventsPreferencesHotel.hotelRoomId,
                    occupants: tUsersEventsPreferencesHotel.hotelRoomOccupants,
                    preferences: tUsersEventsPreferencesHotel.hotelRoomPreferences,
                    checkIn: tUsersEventsPreferencesHotel.hotelCheckIn,
                    checkOut: tUsersEventsPreferencesHotel.hotelCheckOut,
                })
                .executeSelectNoneOrOne();

            if (existing) {
                if (existing.interested === 0 && data.interested === 0)
                    return false;  // no updates - still uninterested

                if (existing.interested === 1 && data.interested === 1 &&
                    existing.roomId === data.roomId &&
                    existing.occupants === data.occupants &&
                    existing.preferences === data.preferences &&
                    existing.checkIn?.toString() === data.checkIn?.toString() &&
                    existing.checkOut?.toString() === data.checkOut?.toString())
                {
                    return false;  // no updates - interested with the same information
                }
            }

            await dbInstance.update(tUsersEventsPreferencesHotel)
                .set({
                    preferenceVersionIsLatest: 0,
                })
                .where(tUsersEventsPreferencesHotel.userId.equals(userId))
                    .and(tUsersEventsPreferencesHotel.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesHotel.preferenceVersionIsLatest.equals(1))
                .executeUpdate();

            await dbInstance.insertInto(tUsersEventsPreferencesHotel)
                .set({
                    userId,
                    eventId: event.id,
                    preferenceVersion: dbInstance.currentZonedDateTime(),
                    preferenceVersionIsLatest: /* true= */ 1,
                    preferenceVersionUserId: props.user.id,
                    hotelInterested: data.interested,
                    hotelRoomId: data.interested ? data.roomId : null,
                    hotelRoomOccupants: data.interested ? data.occupants : null,
                    hotelRoomPreferences: data.interested ? data.preferences : null,
                    hotelCheckIn: data.interested ? data.checkIn : null,
                    hotelCheckOut: data.interested ? data.checkOut : null,
                })
                .executeInsert();

            return true;
        });

        LogBuilder.for('UpdateHotelPreferences')
            .withCondition(updated)
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
            });

        return {
            success: true,
            message: userId === props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

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

            if (existing &&
                existing.includeCreditReel === data.includeCreditReel &&
                existing.includeSocialMedia === data.includeSocialMedia &&
                existing.tshirtFit === data.tshirtFit &&
                existing.tshirtSize === data.tshirtSize)
            {
                return false;  // no updates
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
            message: userId === props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

// -------------------------------------------------------------------------------------------------
// Refund preferences
// -------------------------------------------------------------------------------------------------

// TODO: Refund preferences

// -------------------------------------------------------------------------------------------------
// Training preferences
// -------------------------------------------------------------------------------------------------

/**
 * Schema defining the information required to training participation preferences.
 */
const kTrainingPreferencesSchema = z.object({
    trainingId: z.number(),
});

/**
 * Server Action through which training preferences can be updated. Used for updates from the
 * administration area, as well as through the registration portal.
 */
export async function updateTrainingPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kTrainingPreferencesSchema, async (data, props) => {
        // TODO: Amend the authentication check for updates from the registration portal

        const { event } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        const dbInstance = db;
        const updated = await dbInstance.transaction(async () => {
            const existing = await dbInstance.selectFrom(tUsersEventsPreferencesTraining)
                .where(tUsersEventsPreferencesTraining.userId.equals(userId))
                    .and(tUsersEventsPreferencesTraining.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesTraining.preferenceVersionIsLatest.equals(1))
                .select({
                    trainingId: tUsersEventsPreferencesTraining.trainingId,
                })
                .executeSelectNoneOrOne();

            if (existing && existing.trainingId === data.trainingId)
                return false;  // no updates

            await dbInstance.update(tUsersEventsPreferencesTraining)
                .set({
                    preferenceVersionIsLatest: 0,
                })
                .where(tUsersEventsPreferencesTraining.userId.equals(userId))
                    .and(tUsersEventsPreferencesTraining.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesTraining.preferenceVersionIsLatest.equals(1))
                .executeUpdate();

            await dbInstance.insertInto(tUsersEventsPreferencesTraining)
                .set({
                    userId,
                    eventId: event.id,
                    preferenceVersion: dbInstance.currentZonedDateTime(),
                    preferenceVersionIsLatest: /* true= */ 1,
                    preferenceVersionUserId: props.user.id,
                    trainingId: data.trainingId,
                })
                .executeInsert();

            return true;
        });

        LogBuilder.for('UpdateTrainingPreferences')
            .withCondition(updated)
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
            });

        return {
            success: true,
            message: userId === props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}
