// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { getPublicEventsForFestival } from '@app/registration/[slug]/application/[team]/availability/getPublicEventsForFestival';
import db, { tEvents, tRefunds, tTeams, tTrainingsAssignments, tUsersEvents } from '@lib/database';

import { kServiceHoursProperty, kServiceTimingProperty } from '@app/registration/[slug]/application/ApplicationActions';
import { kRegistrationStatus } from '@lib/database/Types';
import { kTemporalZonedDateTime } from '@app/api/Types';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';

/**
 * Returns context, sourced from the database, for a volunteer action with the following properties.
 */
export async function getContextForVolunteerAction(userId: number, eventId: number, teamId: number)
{
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
 * Server action that clears the refund request associated with a volunteer.
 */
export async function clearRefundPreferences(
    userId: number, eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        const { event } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            permission: 'event.refunds',
            scope: {
                event: event.slug,
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
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be send on the user's behalf. All input should be treated as untrusted until verified.
 */
export async function sendCommunicationToVolunteer(
    eventId: number, teamId: number, recipientId: number, promptId: CommunicationPromptId,
    subject?: string, message?: string)
{
    'use server';

    return executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(recipientId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            permission: 'event.volunteers.information',
            operation: 'update',
            scope: {
                event: event.slug,
                team: team.slug,
            },
        });

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject,
            message,
            metadata: {
                eventId,
                teamId,
                promptId,
            },
        });

        return {
            success: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
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
            permission: 'event.volunteers.information',
            operation: 'update',
            scope: {
                event: event.slug,
                team: team.slug,
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
            permission: 'event.volunteers.overrides',
            scope: {
                event: event.slug,
                team: team.slug,
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
            permission: 'event.refunds',
            scope: {
                event: event.slug,
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
 * Server action that cancels a volunteer's participation.
 */
export async function cancelParticipation(
    userId: number, eventId: number, teamId: number,
    subject?: string, message?: string)
{
    'use server';
    return executeServerAction(new FormData, kNoDataRequired, async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            permission: 'event.applications',
            operation: 'update',
            scope: {
                event: event.slug,
                team: team.slug,
            },
        });

        const isSilent = !subject || !message;
        if (isSilent && !props.access.can('organisation.silent')) {
            return {
                success: false,
                error: 'You do not have permission to make changes without notification.',
            };
        }

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationStatus: kRegistrationStatus.Cancelled,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        if (!affectedRows)
            return { success: false, error: 'Unable to cancel their participation in the database…' };

        if (!isSilent) {
            await sendCommunication({
                sender: props.user,
                recipient: userId,
                subject,
                message,
                metadata: {
                    eventId,
                    teamId,
                    promptId: 'participation-cancelled',
                },
            });
        }

        RecordLog({
            type: kLogType.AdminUpdateTeamVolunteerStatus,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                action: 'Cancelled',
                event: event.shortName,
                eventId, teamId,
            },
        });

        return {
            success: true,
            refresh: true,
            message: isSilent ? 'Their participation has been cancelled silently.'
                              : 'The e-mail has been sent and their participation has been cancelled.',
        };
    });
}

/**
 * Server action that reinstates a volunteer's participation.
 */
export async function reinstateParticipation(
    userId: number, eventId: number, teamId: number,
    subject?: string, message?: string)
{
    'use server';
    return executeServerAction(new FormData, kNoDataRequired, async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(userId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            permission: 'event.applications',
            operation: 'update',
            scope: {
                event: event.slug,
                team: team.slug,
            },
        });

        const isSilent = !subject || !message;
        if (isSilent && !props.access.can('organisation.silent')) {
            return {
                success: false,
                error: 'You do not have permission to make changes without notification.',
            };
        }

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationStatus: kRegistrationStatus.Accepted,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        if (!affectedRows)
            return { success: false, error: 'Unable to reinstate their participation in the database…' };

        if (!isSilent) {
            await sendCommunication({
                sender: props.user,
                recipient: userId,
                subject,
                message,
                metadata: {
                    eventId,
                    teamId,
                    promptId: 'participation-reinstated',
                },
            });
        }

        RecordLog({
            type: kLogType.AdminUpdateTeamVolunteerStatus,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                action: 'Accepted',
                event: event.shortName,
                eventId, teamId,
            },
        });

        return {
            success: true,
            refresh: true,
            message: isSilent ? 'They have been reinstated silently.'
                              : 'The e-mail has been sent and they have been reinstated.',
        };
    });
}

