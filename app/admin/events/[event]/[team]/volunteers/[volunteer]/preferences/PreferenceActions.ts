// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsersEventsPreferencesAvailability, tUsersEventsPreferencesHotel,
    tUsersEventsPreferencesParticipation, tUsersEventsPreferencesRefunds,
    tUsersEventsPreferencesTraining } from '@lib/database';

import { kAvailabilityBuildUpTearDownScheme, kServiceHoursProperty, kServiceTimingProperty }
    from './AvailabilitySettings';
import { kShirtFit, kShirtSize } from '@lib/database/Types';
import { kTemporalPlainDate } from '@app/api/Types';

// -------------------------------------------------------------------------------------------------
// Availability preferences
// -------------------------------------------------------------------------------------------------

/**
 * Schema defining the information required to update availability.
 */
const kAvailabilityPreferencesSchema = z.object({
    buildUpTearDown: z.string().nullish(),
    hours: kServiceHoursProperty,
    timing: kServiceTimingProperty,
    remarks: z.string().nullish(),
});

/**
 * Server Action through which one's availability can be updated. Used for updates from the
 * administration area, as well as through the registration portal.
 */
export async function updateAvailabilityPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kAvailabilityPreferencesSchema, async (data, props) => {
        // TODO: Amend the authentication check for updates from the registration portal

        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        let buildUpTearDown: string | null = null;
        if (!!data.buildUpTearDown) {
            try {
                const deserialisedBuildUpTearDown = JSON.parse(data.buildUpTearDown);
                const validatedBuildUpTearDown = kAvailabilityBuildUpTearDownScheme.parse(
                    deserialisedBuildUpTearDown);

                buildUpTearDown = JSON.stringify(validatedBuildUpTearDown);

            } catch (error: any) {
                return {
                    success: false,
                    error: `Invalid build-up & tear-down data given: ${error}`,
                };
            }
        }

        if (!data.remarks?.length)
            data.remarks = undefined;

        const [ availabilityTimingStart, availabilityTimingEnd ] =
            data.timing.split('-').map(timingValue => parseInt(timingValue, 10));

        const dbInstance = db;
        const updated = await dbInstance.transaction(async () => {
            const existing = await dbInstance.selectFrom(tUsersEventsPreferencesAvailability)
                .where(tUsersEventsPreferencesAvailability.userId.equals(userId))
                    .and(tUsersEventsPreferencesAvailability.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesAvailability.teamId.equals(team.id))
                    .and(tUsersEventsPreferencesAvailability.preferenceVersionIsLatest.equals(1))
                .select({
                    buildUpTearDown: tUsersEventsPreferencesAvailability.availabilityBuildUpTearDown,
                    hours: tUsersEventsPreferencesAvailability.availabilityHours,
                    timingStart: tUsersEventsPreferencesAvailability.availabilityTimingStart,
                    timingEnd: tUsersEventsPreferencesAvailability.availabilityTimingEnd,
                    remarks: tUsersEventsPreferencesAvailability.availabilityRemarks,
                })
                .executeSelectNoneOrOne();

            if (existing &&
                existing.buildUpTearDown === buildUpTearDown &&
                existing.hours === data.hours &&
                existing.timingStart === availabilityTimingStart &&
                existing.timingEnd === availabilityTimingEnd &&
                existing.remarks === data.remarks)
            {
                return false;  // no updates
            }

            await dbInstance.update(tUsersEventsPreferencesAvailability)
                .set({
                    preferenceVersionIsLatest: 0,
                })
                .where(tUsersEventsPreferencesAvailability.userId.equals(userId))
                    .and(tUsersEventsPreferencesAvailability.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesAvailability.teamId.equals(team.id))
                    .and(tUsersEventsPreferencesAvailability.preferenceVersionIsLatest.equals(1))
                .executeUpdate();

            await dbInstance.insertInto(tUsersEventsPreferencesAvailability)
                .set({
                    userId,
                    eventId: event.id,
                    teamId: team.id,
                    preferenceVersion: dbInstance.currentZonedDateTime(),
                    preferenceVersionIsLatest: /* true= */ 1,
                    preferenceVersionUserId: props.user.id,
                    availabilityBuildUpTearDown: buildUpTearDown,
                    availabilityExceptions: null,  // todo: support this
                    availabilityHours: data.hours,
                    availabilityTimeslots: null,  // todo: support this
                    availabilityTimingStart,
                    availabilityTimingEnd,
                    availabilityRemarks: data.remarks,
                })
                .executeInsert();

            return true;
        });

        LogBuilder.for('UpdateAvailabilityPreferences')
            .withCondition(updated)
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                team: team.title,
            });

        return {
            success: true,
            message: userId === props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

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
                permission: 'event.volunteers.information',
                operation: 'update',
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

/**
 * Schema defining the information required to update a refund request.
 */
const kRefundPreferencesSchema = z.object({
    accountName: z.string().nonempty(),
    accountIban: z.string().nonempty(),
    ticketNumber: z.string().optional(),
});

/**
 * Server Action through which a refund request can be updated. Used for updates from the
 * administration area, as well as through the registration portal.
 */
export async function updateRefundPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kRefundPreferencesSchema, async (data, props) => {
        // TODO: Amend the authentication check for updates from the registration portal

        const { event } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, 'event.refunds');

        const dbInstance = db;
        const updated = await dbInstance.transaction(async () => {
            const existing = await dbInstance.selectFrom(tUsersEventsPreferencesRefunds)
                .where(tUsersEventsPreferencesRefunds.userId.equals(userId))
                    .and(tUsersEventsPreferencesRefunds.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesRefunds.preferenceVersionIsLatest.equals(1))
                .select({
                    accountName: tUsersEventsPreferencesRefunds.refundAccountName,
                    accountIban: tUsersEventsPreferencesRefunds.refundAccountIban,
                    ticketNumber: tUsersEventsPreferencesRefunds.refundTicketNumber,
                })
                .executeSelectNoneOrOne();

            if (existing &&
                existing.accountName === data.accountName &&
                existing.accountIban === data.accountIban &&
                existing.ticketNumber === data.ticketNumber)
            {
                return false;  // no updates
            }

            await dbInstance.update(tUsersEventsPreferencesRefunds)
                .set({
                    preferenceVersionIsLatest: 0,
                })
                .where(tUsersEventsPreferencesRefunds.userId.equals(userId))
                    .and(tUsersEventsPreferencesRefunds.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesRefunds.preferenceVersionIsLatest.equals(1))
                .executeUpdate();

            await dbInstance.insertInto(tUsersEventsPreferencesRefunds)
                .set({
                    userId,
                    eventId: event.id,
                    preferenceVersion: dbInstance.currentZonedDateTime(),
                    preferenceVersionIsLatest: /* true= */ 1,
                    preferenceVersionUserId: props.user.id,
                    refundAccountName: data.accountName,
                    refundAccountIban: data.accountIban,
                    refundTicketNumber: data.ticketNumber,
                })
                .executeInsert();

            return true;
        });

        LogBuilder.for('UpdateRefundPreferences')
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
