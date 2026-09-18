// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { LogBuilder } from '@lib/log/index';
import { requireVolunteerAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import { executeServerAction } from '@lib/serverAction';
import db, { tRoles, tUsersEvents, tUsersEventsPreferencesAvailability,
    tUsersEventsPreferencesHotel, tUsersEventsPreferencesParticipation,
    tUsersEventsPreferencesRefunds, tUsersEventsPreferencesTraining } from '@lib/database';

import { kTemporalPlainDate, kTemporalZonedDateTime } from '@app/api/Types';
import { kShirtFit, kShirtSize } from '@lib/database/Types';
import { kAvailabilityBuildUpTearDownScheme, kServiceHoursProperty, kServiceTimingProperty }
    from './AvailabilitySettings';

// -------------------------------------------------------------------------------------------------
// Availability preferences
// -------------------------------------------------------------------------------------------------

/**
 * Validates the data required to update availability preferences.
 */
const kAvailabilityPreferencesSchema = z.object({
    buildUpTearDown: z.string().nullish(),
    exceptions: z.string().optional(),
    hours: kServiceHoursProperty,
    timeslots: z.array(z.number().nullish()).optional(),
    timing: kServiceTimingProperty,
    remarks: z.string().nullish(),
});

/**
 * Updates the availability preferences of a volunteer.
 */
export async function updateAvailabilityPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kAvailabilityPreferencesSchema, async (data, props) => {
        const { event, team } = await requireVolunteerAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        if (props.user.id !== userId) {
            executeAccessCheck(props.authenticationContext, {
                permission: 'volunteers.participation',
                operation: 'update',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            });
        }

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

        let exceptions: string | undefined;
        if (!!data.exceptions) {
            const kExceptionSchema = z.array(z.object({
                start: kTemporalZonedDateTime,
                end: kTemporalZonedDateTime,
                state: z.enum([ 'available', 'avoid', 'unavailable' ]),
            }));

            try {
                const unvalidatedExceptions = JSON.parse(data.exceptions);
                const validatedExceptions = kExceptionSchema.parse(unvalidatedExceptions);

                exceptions = JSON.stringify(validatedExceptions.map(exception => ({
                    start: exception.start.toString(),
                    end: exception.end.toString(),
                    state: exception.state,
                })));

            } catch (error: any) {
                return {
                    success: false,
                    error: `Invalid availability exceptions given: ${error}`,
                };
            }
        }

        if (!data.remarks?.length)
            data.remarks = undefined;

        let timeslots: string | undefined;
        if (!!data.timeslots) {
            const timeslotSet = new Set(data.timeslots.filter(Boolean) as number[]);
            if (timeslotSet.size)
                timeslots = [ ...timeslotSet ].join(',');
        }

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
                    exceptions: tUsersEventsPreferencesAvailability.availabilityExceptions,
                    fullyAvailable: tUsersEventsPreferencesAvailability.availabilityFullyAvailable,
                    hours: tUsersEventsPreferencesAvailability.availabilityHours,
                    timeslots: tUsersEventsPreferencesAvailability.availabilityTimeslots,
                    timingStart: tUsersEventsPreferencesAvailability.availabilityTimingStart,
                    timingEnd: tUsersEventsPreferencesAvailability.availabilityTimingEnd,
                    remarks: tUsersEventsPreferencesAvailability.availabilityRemarks,
                })
                .executeSelectNoneOrOne();

            // Volunteers cannot alter their exceptions, so preserve them from earlier versions.
            const carriedForwardExceptions =
                !data.exceptions ? existing?.exceptions
                                 : exceptions;

            if (existing &&
                existing.buildUpTearDown === buildUpTearDown &&
                existing.exceptions === carriedForwardExceptions &&
                existing.hours === data.hours &&
                existing.timeslots === timeslots &&
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
                    availabilityExceptions: carriedForwardExceptions,
                    availabilityFullyAvailable: existing?.fullyAvailable ?? /* default= */ 1,
                    availabilityHours: data.hours,
                    availabilityTimeslots: timeslots,
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
            message: userId !== props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

// -------------------------------------------------------------------------------------------------
// Hotel preferences
// -------------------------------------------------------------------------------------------------

/**
 * Validates the data required to update hotel preferences.
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
 * Updates the hotel preferences of a volunteer.
 */
export async function updateHotelPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kHotelPreferencesSchema, async (data, props) => {
        const { event, team } = await requireVolunteerAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        if (!event.flags.enableHotel)
            notFound();

        if (props.user.id !== userId) {
            executeAccessCheck(props.authenticationContext, {
                permission: 'volunteers.participation',
                operation: 'update',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            });
        } else if (!!data.interested) {
            const eligibility = await db.selectFrom(tUsersEvents)
                .innerJoin(tRoles)
                    .on(tRoles.roleId.equals(tUsersEvents.roleId))
                .where(tUsersEvents.userId.equals(userId))
                    .and(tUsersEvents.eventId.equals(event.id))
                    .and(tUsersEvents.teamId.equals(team.id))
                .selectOneColumn(
                    tUsersEvents.hotelEligible.valueWhenNull(tRoles.roleHotelEligible))
                .executeSelectNoneOrOne();

            if (!eligibility)
                forbidden();
        }

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
            message: userId !== props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

// -------------------------------------------------------------------------------------------------
// Participation preferences
// -------------------------------------------------------------------------------------------------

/**
 * Validates the data required to update participation preferences.
 */
const kParticipationPreferencesSchema = z.object({
    dietary: z.string().nullish(),
    includeCreditReel: z.union([ z.literal(0), z.literal(1) ]),
    includeSocialMedia: z.union([ z.literal(0), z.literal(1) ]),
    tshirtFit: z.enum(kShirtFit),
    tshirtSize: z.enum(kShirtSize),
});

/**
 * Updates the participation preferences of a volunteer.
 */
export async function updateParticipationPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kParticipationPreferencesSchema, async (data, props) => {
        const { event, team } = await requireVolunteerAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        if (props.user.id !== userId) {
            executeAccessCheck(props.authenticationContext, {
                permission: 'volunteers.participation',
                operation: 'update',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            });
        }

        const dbInstance = db;
        const updated = await dbInstance.transaction(async () => {
            const existing = await dbInstance.selectFrom(tUsersEventsPreferencesParticipation)
                .where(tUsersEventsPreferencesParticipation.userId.equals(userId))
                    .and(tUsersEventsPreferencesParticipation.eventId.equals(event.id))
                    .and(tUsersEventsPreferencesParticipation.preferenceVersionIsLatest.equals(1))
                .select({
                    dietary: tUsersEventsPreferencesParticipation.participationDietary,
                    includeCreditReel:
                        tUsersEventsPreferencesParticipation.participationIncludeCreditReel,
                    includeSocialMedia:
                        tUsersEventsPreferencesParticipation.participationIncludeSocialMedia,
                    tshirtFit: tUsersEventsPreferencesParticipation.participationTshirtFit,
                    tshirtSize: tUsersEventsPreferencesParticipation.participationTshirtSize,
                })
                .executeSelectNoneOrOne();

            const existingDietary = existing?.dietary || null;
            const updatedDietary = data.dietary || null;

            if (existing &&
                existingDietary === updatedDietary &&
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
                    participationDietary: data.dietary || null,
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
            message: userId !== props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

// -------------------------------------------------------------------------------------------------
// Refund preferences
// -------------------------------------------------------------------------------------------------

/**
 * Validates the data required to update a refund request.
 */
const kRefundPreferencesSchema = z.object({
    accountName: z.string().nonempty(),
    accountIban: z.string().nonempty(),
    ticketNumber: z.string().optional(),
});

/**
 * Updates the refund request preferences of a volunteer.
 */
export async function updateRefundPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kRefundPreferencesSchema, async (data, props) => {
        const { event, team } = await requireVolunteerAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        if (!event.flags.enableRefunds)
            notFound();

        if (props.user.id !== userId) {
            executeAccessCheck(props.authenticationContext, 'event.refunds', {
                event: event.slug,
                team: team.slug,
            });
        }

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
            message: userId !== props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}

// -------------------------------------------------------------------------------------------------
// Training preferences
// -------------------------------------------------------------------------------------------------

/**
 * Validates the data required to update training preferences.
 */
const kTrainingPreferencesSchema = z.object({
    trainingId: z.number(),
});

/**
 * Updates the training preferences of a volunteer.
 */
export async function updateTrainingPreferences(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kTrainingPreferencesSchema, async (data, props) => {
        const { event, team } = await requireVolunteerAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        if (!event.flags.enableTraining)
            notFound();

        if (props.user.id !== userId) {
            executeAccessCheck(props.authenticationContext, {
                permission: 'volunteers.participation',
                operation: 'update',
            }, {
                event: event.slug,
                team: team.slug,
            });
        } else if (data.trainingId !== 0) {
            const eligibility = await db.selectFrom(tUsersEvents)
                .innerJoin(tRoles)
                    .on(tRoles.roleId.equals(tUsersEvents.roleId))
                .where(tUsersEvents.userId.equals(userId))
                    .and(tUsersEvents.eventId.equals(event.id))
                    .and(tUsersEvents.teamId.equals(team.id))
                .selectOneColumn(
                    tUsersEvents.trainingEligible.valueWhenNull(tRoles.roleTrainingEligible))
                .executeSelectNoneOrOne();

            if (!eligibility)
                forbidden();
        }

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
            message: userId !== props.user.id ? undefined : 'Your preferences have been updated.',
        };
    });
}
