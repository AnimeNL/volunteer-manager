// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { Temporal } from '@lib/Temporal';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { getPublicEventsForFestival } from '@app/registration/[slug]/application/[team]/availability/getPublicEventsForFestival';
import db, { tEvents, tHotelsPreferences, tRefunds, tTeams, tTrainingsAssignments, tUsersEvents } from '@lib/database';

import { kServiceHoursProperty, kServiceTimingProperty } from '@app/registration/[slug]/application/ApplicationActions';
import { kShirtFit, kShirtSize } from '@lib/database/Types';
import { kTemporalPlainDate, kTemporalZonedDateTime } from '@app/api/Types';

/**
 * Returns context, sourced from the database, for a volunteer action with the following properties.
 */
async function getContextForVolunteerAction(userId: number, eventId: number, teamId: number) {
    const result = await db.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.teamId.equals(teamId))
        .select({
            event: {
                id: tEvents.eventId,

                festivalId: tEvents.eventFestivalId,
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,
                timezone: tEvents.eventTimezone,
            },
            team: {
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
            },
        })
        .executeSelectNoneOrOne();

    if (!result)
        notFound();  // the given information cannot be validated

    return result;
}

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Server action that clears the hotel preferences associated with a volunteer.
 */
export async function clearHotelPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.hotels',
                scope: {
                    event: event.slug,
                },
            },
        });

        const affectedRows = await db.deleteFrom(tHotelsPreferences)
            .where(tHotelsPreferences.userId.equals(userId))
                .and(tHotelsPreferences.eventId.equals(eventId))
            .executeDelete();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminClearHotelPreferences,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                targetUser: userId,
                data: {
                    event: event.shortName,
                },
            });
        }

        return { success: true, clear: true };
    });
}

/**
 * Server action that clears the refund request associated with a volunteer.
 */
export async function clearRefundPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.refunds',
                scope: {
                    event: event.slug,
                },
            },
        });

        const affectedRows = await db.deleteFrom(tRefunds)
            .where(tRefunds.userId.equals(userId))
                .and(tRefunds.eventId.equals(eventId))
            .executeDelete();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminClearRefundRequest,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                targetUser: userId,
                data: {
                    event: event.shortName,
                },
            });
        }

        return { success: true, clear: true };
    });
}

/**
 * Server action that clears the training preferences associated with a volunteer.
 */
export async function clearTrainingPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.trainings',
                scope: {
                    event: event.slug,
                },
            },
        });

        const affectedRows = await db.deleteFrom(tTrainingsAssignments)
            .where(tTrainingsAssignments.assignmentUserId.equals(userId))
                .and(tTrainingsAssignments.eventId.equals(eventId))
            .executeDelete();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminClearTrainingPreferences,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                targetUser: userId,
                data: {
                    event: event.shortName,
                },
            });
        }

        return { success: true, clear: true };
    });
}

/**
 * Zod type that describes the data required for updating an application.
 */
const kUpdateApplicationData = z.object({
    credits: z.number().optional(),
    socials: z.number().optional(),
    tshirtFit: z.enum(kShirtFit),
    tshirtSize: z.enum(kShirtSize),
});

/**
 * Server action that updates the information associated with an application.
 */
export async function updateApplication(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateApplicationData, async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.volunteers.information',
                operation: 'update',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            },
        });

        const affectedRows = await db.update(tUsersEvents)
            .set({
                shirtFit: data.tshirtFit,
                shirtSize: data.tshirtSize,
                includeCredits: data.credits ? 1 : 0,
                includeSocials: data.socials ? 1 : 0,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the information in the database…' };

        RecordLog({
            type: kLogType.AdminUpdateTeamVolunteer,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                event: event.shortName,
                eventId, teamId,
            },
        });

        return { success: true };
    });
}

/**
 * Zod type that describes the data required to update a volunteer's hotel preferences.
 */
const kUpdateAvailabilityPreferenceData = z.object({
    exceptionEvents: z.array(z.number().nullish()).optional(),
    exceptions: z.string().optional(),
    serviceHours: kServiceHoursProperty,
    serviceTiming: kServiceTimingProperty,
    preferences: z.string().optional(),
    preferencesDietary: z.string().optional(),
    availabilityBuildUpTearDown: z.string().optional(),
});

/**
 * Server action that updates the availability preferences of a volunteer.
 */
export async function updateAvailability(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateAvailabilityPreferenceData, async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.volunteers.information',
                operation: 'update',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            },
        });

        const [ serviceTimingStart, serviceTimingEnd ] = data.serviceTiming.split('-');

        const exceptionEvents: number[] = [ /* no exception events */ ];
        if (!!event.festivalId && !!data.exceptionEvents?.length) {
            const validEvents =
                await getPublicEventsForFestival(
                    event.festivalId, event.timezone, /* withTimingInfo= */ false);

            const validEventIds = new Set(validEvents.map(v => v.id));
            for (const exceptionEvent of data.exceptionEvents) {
                if (!exceptionEvent)
                    continue;  // this is a nullsy value, i.e. not a real timeslot

                if (!validEventIds.has(exceptionEvent))
                    continue;  // the validity of this event cannot be confirmed

                exceptionEvents.push(exceptionEvent);
            }
        }

        let exceptions: string | undefined;
        if (!!data.exceptions && data.exceptions.length > 2) {
            try {
                const kExceptionType = z.array(z.object({
                    start: kTemporalZonedDateTime,
                    end: kTemporalZonedDateTime,
                    state: z.enum([ 'available', 'avoid', 'unavailable' ]),
                }));

                const parsedExceptions = JSON.parse(data.exceptions);
                const validatedExceptions = kExceptionType.parse(parsedExceptions);

                exceptions = JSON.stringify(validatedExceptions.map(exception => ({
                    ...exception,
                    start: exception.start.toString(),
                    end: exception.end.toString(),
                })));

            } catch (error) {
                console.warn('Unable to parse availability exceptions:', error);
                return { success: false, error: 'Unable to validate the availability exceptions…' };
            }
        }

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tUsersEvents)
            .set({
                availabilityBuildUpTearDown: data.availabilityBuildUpTearDown,
                availabilityExceptions: exceptions,
                availabilityTimeslots: exceptionEvents.join(','),
                preferences: data.preferences,
                preferencesDietary: data.preferencesDietary,
                preferenceHours: parseInt(data.serviceHours, /* radix= */ 10),
                preferenceTimingStart: parseInt(serviceTimingStart, /* radix= */ 10),
                preferenceTimingEnd: parseInt(serviceTimingEnd, /* radix= */ 10),
                preferencesUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to save their preferences in the database…' };

        RecordLog({
            type: kLogType.AdminUpdateAvailabilityPreferences,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                event: event.shortName,
                preferences: data.preferences,
                serviceHours: data.serviceHours,
                serviceTiming: data.serviceTiming,
                timeslots: exceptionEvents,
            },
        });

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes the data required to update a volunteer's hotel preferences.
 */
const kUpdateHotelPreferencesData = z.object({
    interested: z.number(),

    // When interested:
    hotelId: z.number().optional(),
    checkIn: kTemporalPlainDate.optional(),
    checkOut: kTemporalPlainDate.optional(),
    sharingPeople: z.number().optional(),
    sharingPreferences: z.string().optional(),
});

/**
 * Server action that updates the hotel preferences of a volunteer.
 */
export async function updateHotelPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateHotelPreferencesData, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.hotels',
                scope: {
                    event: event.slug,
                },
            },
        });

        let update: {
            hotelId: number | null,
            hotelDateCheckIn: Temporal.PlainDate | null,
            hotelDateCheckOut: Temporal.PlainDate | null,
            hotelSharingPeople: number | null,
            hotelSharingPreferences: string | null
        };

        if (!data.interested) {
            update = {
                hotelId: null,
                hotelDateCheckIn: null,
                hotelDateCheckOut: null,
                hotelSharingPeople: null,
                hotelSharingPreferences: null,
            };
        } else {
            if (!data.hotelId)
                return { success: false, error: 'You must select a hotel room…' };

            if (!data.checkIn || !data.checkOut)
                return { success: false, error: 'You must select the dates for your booking…' };

            if (!data.sharingPeople || !data.sharingPreferences)
                return { success: false, error: 'You must select who you want to share with…' };

            update = {
                hotelId: data.hotelId,
                hotelDateCheckIn: data.checkIn,
                hotelDateCheckOut: data.checkOut,
                hotelSharingPeople: data.sharingPeople,
                hotelSharingPreferences: data.sharingPreferences,
            };
        }

        const dbInstance = db;
        const affectedRows = await dbInstance.insertInto(tHotelsPreferences)
            .set({
                userId: props.user!.id,
                eventId: eventId,
                teamId: teamId,  // TODO: remove the team association
                ...update,
                hotelPreferencesUpdated: dbInstance.currentZonedDateTime()
            })
            .onConflictDoUpdateSet({
                ...update,
                hotelPreferencesUpdated: dbInstance.currentZonedDateTime()
            })
            .executeInsert();

        if (!affectedRows)
            return { success: false, error: 'Unable to update your preferences in the database…' };

        RecordLog({
            type: kLogType.ApplicationHotelPreferences,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                event: event.shortName,
                interested: !!data.interested,
                hotelId: data.hotelId,
            },
        });

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes the data required to update a volunteer's metadata.
 */
const kUpdateMetadataData = z.object({
    availabilityEventLimit: z.number().min(0).max(32).optional(),
    hotelEligible: z.number().optional(),
    registrationDate: kTemporalZonedDateTime.optional(),
    trainingEligible: z.number().optional(),
});

/**
 * Server action that updates the metadata associated with a volunteer.
 */
export async function updateMetadata(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateMetadataData, async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.volunteers.overrides',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            },
        });

        let availabilityEventLimit: number | null = null;
        if (typeof data.availabilityEventLimit === 'number')
            availabilityEventLimit = data.availabilityEventLimit;

        let hotelEligible: number | null = null;
        if ([ 0, 1 ].includes(data.hotelEligible ?? -1))
            hotelEligible = !!data.hotelEligible ? 1 : 0;

        const registrationDate = data.registrationDate ?? null;

        let trainingEligible: number | null = null;
        if ([ 0, 1 ].includes(data.trainingEligible ?? -1))
            trainingEligible = !!data.trainingEligible ? 1 : 0;


        const affectedRows = await db.update(tUsersEvents)
            .set({
                availabilityEventLimit,
                hotelEligible,
                trainingEligible,
                registrationDate,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to update the information in the database…' };

        RecordLog({
            type: kLogType.AdminUpdateTeamVolunteer,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                event: event.shortName,
                eventId, teamId,
            },
        });

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes the data required to update a volunteer's notes.
 */
const kUpdateNotesData = z.object({
    notes: z.string(),
});

/**
 * Server action that updates the stored notes for a volunteer.
 */
export async function updateNotes(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateNotesData, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
        });

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationNotes: !!data.notes.length ? data.notes : undefined,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the notes in the database…' };

        RecordLog({
            type: kLogType.EventVolunteerNotes,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                event: event.shortName,
                notes: data.notes,
            },
        });

        return { success: true };
    });
}

/**
 * Zod type that describes the data required to update a volunteer's refund request.
 */
const kUpdateRefundPreferencesData = z.object({
    ticketNumber: z.string().optional(),
    accountIban: z.string().min(1),
    accountName: z.string().min(1),
});

/**
 * Server action that updates the refund preferences of a volunteer.
 */
export async function updateRefundPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateRefundPreferencesData, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.refunds',
                scope: {
                    event: event.slug,
                },
            },
        });

        const dbInstance = db;
        const affectedRows = await dbInstance.insertInto(tRefunds)
            .set({
                userId,
                eventId,

                refundTicketNumber: data.ticketNumber,
                refundAccountIban: data.accountIban,
                refundAccountName: data.accountName,
                refundRequested: dbInstance.currentZonedDateTime(),
            })
            .onConflictDoUpdateSet({
                refundTicketNumber: data.ticketNumber,
                refundAccountIban: data.accountIban,
                refundAccountName: data.accountName,
                refundRequested: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the request in the database…' };

        RecordLog({
            type: kLogType.ApplicationRefundRequest,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                event: event.shortName,
            },
        });

        return { success: true };
    });
}

/**
 * Zod type that describes the data required to update a volunteer's training preferences.
 */
const kUpdateTrainingPreferencesData = z.object({
    training: z.number(),
});

/**
 * Server action that updates the training preferences of a volunteer.
 */
export async function updateTrainingPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateTrainingPreferencesData, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.trainings',
                scope: {
                    event: event.slug,
                },
            },
        });

        let preferenceTrainingId: number | null = null;
        if (data.training >= 1)
            preferenceTrainingId = data.training;

        const dbInstance = db;
        const affectedRows = await dbInstance.insertInto(tTrainingsAssignments)
            .set({
                eventId,
                assignmentUserId: userId,
                assignmentExtraId: null,

                preferenceTrainingId,
                preferenceUpdated: dbInstance.currentZonedDateTime()
            })
            .onConflictDoUpdateSet({
                preferenceTrainingId,
                preferenceUpdated: dbInstance.currentZonedDateTime()
            })
            .executeInsert();

        if (!affectedRows)
            return { success: false, error: 'Unable to update the preferences in the database…' };

        RecordLog({
            type: kLogType.AdminUpdateTrainingPreferences,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                event: event.shortName,
                training: data.training,
            },
        });

        return { success: true };
    });
}
