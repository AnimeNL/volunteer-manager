// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { Publish } from '@lib/subscriptions';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { isAfter, isBefore, Temporal } from '@lib/Temporal';
import { determineAvailabilityStatus } from '@lib/EnvironmentContext';
import { executeServerAction } from '@lib/serverAction';
import { getPublicEventsForFestival } from './[team]/availability/getPublicEventsForFestival';
import { getStaticContent } from '@lib/Content';
import db, { tEnvironments, tEvents, tEventsTeams, tHotelsPreferences, tRefunds, tRoles, tTeams,
    tTeamsRoles, tTrainingsAssignments, tUsersEvents } from '@lib/database';

import { kRegistrationStatus, kShirtFit, kShirtSize, kSubscriptionType } from '@lib/database/Types';
import { kTemporalPlainDate } from '@app/api/Types';

/**
 * Number of hours that the volunteer would like to help us out with.
 */
export const kServiceHoursProperty = z.enum([ '12', '16', '20', '24' ]);

/**
 * Timing of the shifts the volunteer would like to fulfill.
 */
export const kServiceTimingProperty = z.enum([ '8-20', '10-0', '14-3' ]);

/**
 * Zod type that describes the data required when creating an application.
 */
const kCreateApplicationData = z.object({
    tshirtSize: z.enum(kShirtSize),
    tshirtFit: z.enum(kShirtFit),

    serviceHours: kServiceHoursProperty,
    serviceTiming: kServiceTimingProperty,

    preferences: z.string().optional(),

    availability: z.boolean(),
    credits: z.boolean(),
    socials: z.boolean(),
});

/**
 * Server action that creates a new environment in the Volunteer Manager.
 */
export async function createApplication(eventId: number, teamId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateApplicationData, async (data, props) => {
        if (!props.user)
            return { success: false, error: 'Please sign in or create an account first…' };

        const dbInstance = db;

        // -----------------------------------------------------------------------------------------
        // Validate the |eventId| and the |teamId| to confirm that they exist and are associated
        // with each other, i.e. that the team participates in the event.
        // -----------------------------------------------------------------------------------------

        const eventInfo = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventId.equals(eventId))
            .select({
                endTime: tEvents.eventEndTime,
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,
            })
            .executeSelectNoneOrOne();

        if (!eventInfo)
            return { success: false, error: 'Unable to identify the appropriate event…' };

        const teamInfo = await dbInstance.selectFrom(tTeams)
            .innerJoin(tTeamsRoles)
                .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                    .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
            .innerJoin(tEventsTeams)
                .on(tEventsTeams.teamId.equals(tTeams.teamId))
                    .and(tEventsTeams.eventId.equals(eventId))
                    .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
            .innerJoin(tEnvironments)
                .on(tEnvironments.environmentId.equals(tTeams.teamEnvironmentId))
            .where(tTeams.teamId.equals(teamId))
                .and(tTeams.teamDeleted.isNull())
            .select({
                defaultRoleId: tTeamsRoles.roleId,
                domain: tEnvironments.environmentDomain,
                name: tTeams.teamName,
                slug: tTeams.teamSlug,
                title: tTeams.teamTitle,

                applicationWindow: {
                    start: tEventsTeams.enableApplicationsStart,
                    end: tEventsTeams.enableApplicationsEnd,
                },
            })
            .executeSelectNoneOrOne();

        if (!teamInfo)
            return { success: false, error: 'Unable to identify the appropriate team…' };

        // -----------------------------------------------------------------------------------------
        // Validate that the team is presently accepting applications.
        // -----------------------------------------------------------------------------------------

        const currentTime = Temporal.Now.zonedDateTimeISO('utc');

        const availabilityStatus = determineAvailabilityStatus(currentTime, eventInfo.endTime, {
            ...teamInfo.applicationWindow,
            override: props.access.can('event.visible', {
                event: eventInfo.slug,
                team: teamInfo.slug,
            }),
        });

        switch (availabilityStatus) {
            case 'future':
                return { success: false, error: 'Sorry, applications are not being accepted yet…' };

            case 'past':
                return { success: false, error: 'Sorry, applications are no longer accepted…' };

            case 'active':
            case 'override':
                break;
        }

        // -----------------------------------------------------------------------------------------
        // Validate that the volunteer does not have an existing application with this team yet.
        // -----------------------------------------------------------------------------------------

        const existingApplication = await dbInstance.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(props.user.id))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .selectCountAll()
            .executeSelectNoneOrOne() ?? 0;

        if (existingApplication > 0)
            return { success: false, error: 'You already have an active application…' };

        // -----------------------------------------------------------------------------------------
        // Submit the application.
        // -----------------------------------------------------------------------------------------

        const [ preferenceTimingStart, preferenceTimingEnd ] =
            data.serviceTiming.split('-').map(v => parseInt(v, 10));

        const affectedRows = await dbInstance.insertInto(tUsersEvents)
            .set({
                userId: props.user.id,
                eventId,
                teamId,
                roleId: teamInfo.defaultRoleId,
                registrationDate: dbInstance.currentZonedDateTime(),
                registrationStatus: kRegistrationStatus.Registered,
                shirtFit: data.tshirtFit,
                shirtSize: data.tshirtSize,
                preferenceHours: parseInt(data.serviceHours, 10),
                preferenceTimingStart, preferenceTimingEnd,
                preferences: data.preferences,
                preferencesUpdated: dbInstance.currentZonedDateTime(),
                fullyAvailable: data.availability ? 1 : 0,
                includeCredits: data.credits ? 1 : 0,
                includeSocials: data.socials ? 1 : 0,
            })
            .executeInsert();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the application in the database…' };

        // -----------------------------------------------------------------------------------------
        // Tell the world about this application. This starts by writing a log entry, after which
        // we publish the event and send an e-mail to the volunteer to confirm their action.
        // -----------------------------------------------------------------------------------------

        RecordLog({
            type: kLogType.EventApplication,
            sourceUser: props.user,
            data: {
                event: eventInfo.shortName,
                team: teamInfo.name,
            },
        });

        const applicationConfirmation =
            await getStaticContent([ 'message', 'application-confirmation' ], {
                event: eventInfo.shortName,
                eventSlug: eventInfo.slug,
                hostname: teamInfo.domain,
                name: props.user.nameOrFirstName,
                team: teamInfo.name,
            });

        if (applicationConfirmation) {
            await SendEmailTask.Schedule({
                sender: `AnimeCon ${teamInfo.title}`,
                message: {
                    to: props.user.username!,
                    subject: applicationConfirmation.title,
                    markdown: applicationConfirmation.markdown,
                },
                attribution: {
                    sourceUserId: props.user.id,
                    targetUserId: props.user.id,
                },
            });
        }

        await Publish({
            type: kSubscriptionType.Application,
            typeId: teamId,
            sourceUserId: props.user.id,
            message: {
                userId: props.user.id,
                name: props.user.name,
                event: eventInfo.shortName,
                eventSlug: eventInfo.slug,
                teamEnvironment: teamInfo.domain,
                teamName: teamInfo.name,
                teamSlug: teamInfo.slug,
                teamTitle: teamInfo.title,
            },
        });

        // -----------------------------------------------------------------------------------------
        // Conclude the application process. Refreshing the page will show them the progress of
        // their in-progress application(s), even when there are multiple.
        // -----------------------------------------------------------------------------------------

        return { success: true, refresh: true };

    }, /* allowVisitors= */ true);
}

/**
 * Zod type that describes the data required when creating an application.
 */
const kRequestRefundData = z.object({
    ticketNumber: z.string().optional(),
    accountIban: z.string().min(1),
    accountName: z.string().min(1),
});

/**
 * Server action that requests a refund on behalf of the signed in user.
 */
export async function requestRefund(eventId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kRequestRefundData, async (data, props) => {
        const dbInstance = db;

        const event = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventId.equals(eventId))
            .select({
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,
            })
            .executeSelectNoneOrOne();

        if (!event)
            notFound();

        // -----------------------------------------------------------------------------------------
        // Confirm whether the signed in user has the ability to submit a refund request right now.
        // -----------------------------------------------------------------------------------------

        if (!props.access.can('event.refunds', { event: event.slug })) {
            const availability = await dbInstance.selectFrom(tEvents)
                .where(tEvents.eventId.equals(eventId))
                .select({
                    refundRequestsStart: tEvents.refundRequestsStart,
                    refundRequestsEnd: tEvents.refundRequestsEnd,
                })
                .executeSelectOne();

            if (!availability.refundRequestsStart || !availability.refundRequestsEnd)
                return { success: false, error: 'Sorry, refunds are not being accepted…' };

            const currentTime = Temporal.Now.zonedDateTimeISO('utc');
            if (Temporal.ZonedDateTime.compare(currentTime, availability.refundRequestsStart) < 0)
                return { success: false, error: 'Sorry, refunds are not being accepted yet…' };
            if (Temporal.ZonedDateTime.compare(currentTime, availability.refundRequestsEnd) >= 0)
                return { success: false, error: 'Sorry, refunds are not being accepted anymore…' };
        }

        // -----------------------------------------------------------------------------------------
        // Actually submit the refund request in the database.
        // -----------------------------------------------------------------------------------------

        const affectedRows = await dbInstance.insertInto(tRefunds)
            .set({
                userId: props.user.id,
                eventId: eventId,

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
            return { success: false, error: 'Unable to store your request in the database…' };

        RecordLog({
            type: kLogType.ApplicationRefundRequest,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                event: event.shortName,
            },
        });

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes the data required when updating availability information.
 */
const kUpdateAvailabilityData = z.object({
    exceptionEvents: z.array(z.number().nullish()).optional(),
    serviceHours: kServiceHoursProperty,
    serviceTiming: kServiceTimingProperty,
    preferences: z.string().optional(),
    preferencesDietary: z.string().optional(),
    availabilityBuildUpTearDown: z.string().optional(),
});

/**
 * Server action that enables volunteers to update their availability information.
 */
export async function updateAvailability(eventId: number, teamId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateAvailabilityData, async (data, props) => {
        const dbInstance = db;

        const verification = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .where(tUsersEvents.userId.equals(props.user.id))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .select({
                event: {
                    availabilityBuildUpEnabled: tEvents.availabilityBuildUp.equals(/* true= */ 1),
                    availabilityTearDownEnabled: tEvents.availabilityTearDown.equals(/* true= */ 1),
                    availabilityStatus: tEvents.eventAvailabilityStatus,
                    festivalId: tEvents.eventFestivalId,
                    shortName: tEvents.eventShortName,
                    slug: tEvents.eventSlug,
                    timezone: tEvents.eventTimezone,
                },
                settings: {
                    exceptionEventLimit: tUsersEvents.availabilityEventLimit.valueWhenNull(
                        tRoles.roleAvailabilityEventLimit),
                },
                team: {
                    slug: tTeams.teamSlug,
                },
            })
            .executeSelectNoneOrOne();

        if (!verification)
            notFound();

        const { event, settings, team } = verification;

        if (!props.access.can('event.visible', { event: event.slug, team: team.slug })) {
            if (event.availabilityStatus !== 'Available')
                return { success: false, error: 'You are not able to share your preferences…' };
        }

        // -----------------------------------------------------------------------------------------

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
                if (exceptionEvents.length >= settings.exceptionEventLimit)
                    break;  // the maximum number of exceptions have been created
            }
        }

        // -----------------------------------------------------------------------------------------

        const affectedRows = await dbInstance.update(tUsersEvents)
            .dynamicSet()
            .setWhen(event.availabilityBuildUpEnabled || event.availabilityTearDownEnabled, {
                availabilityBuildUpTearDown: data.availabilityBuildUpTearDown,
            })
            .setWhen(!!data.exceptionEvents, {
                availabilityTimeslots: exceptionEvents.join(','),
            })
            .set({
                preferences: data.preferences,
                preferencesDietary: data.preferencesDietary,
                preferenceHours: parseInt(data.serviceHours, /* radix= */ 10),
                preferenceTimingStart: parseInt(serviceTimingStart, /* radix= */ 10),
                preferenceTimingEnd: parseInt(serviceTimingEnd, /* radix= */ 10),
                preferencesUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tUsersEvents.userId.equals(props.user.id))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to save your preferences in the database…' };

        RecordLog({
            type: kLogType.ApplicationAvailabilityPreferences,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
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
 * Zod type that describes the data required when updating their hotel preferences.
 */
const kUpdateHotelPreferences = z.object({
    interested: z.number(),

    // When interested:
    hotelId: z.number().optional(),
    checkIn: kTemporalPlainDate.optional(),
    checkOut: kTemporalPlainDate.optional(),
    sharingPeople: z.number().optional(),
    sharingPreferences: z.string().optional(),
});

/**
 * Server action that enables volunteers to update their hotel preferences.
 */
export async function updateHotelPreferences(eventId: number, teamId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateHotelPreferences, async (data, props) => {
        const dbInstance = db;

        const verification = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .where(tUsersEvents.userId.equals(props.user.id))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .select({
                event: {
                    shortName: tEvents.eventShortName,
                    slug: tEvents.eventSlug,
                },
                settings: {
                    availability: {
                        start: tEvents.hotelPreferencesStart,
                        end: tEvents.hotelPreferencesEnd,
                    },
                    detailsPublished: tEvents.hotelInformationPublished,
                    eligible: tUsersEvents.hotelEligible.valueWhenNull(tRoles.roleHotelEligible),
                },
            })
            .executeSelectNoneOrOne();

        if (!verification)
            notFound();

        const { event, settings } = verification;

        // -----------------------------------------------------------------------------------------
        // Verify that the signed in user is able to update their preferences.
        // -----------------------------------------------------------------------------------------

        if (!props.access.can('event.hotels', { event: event.slug })) {
            if (!settings.detailsPublished || !settings.eligible)
                forbidden();  // the page shouldn't be accessible

            const currentTime = Temporal.Now.zonedDateTimeISO('utc');

            if (!!settings.availability) {
                const { start, end } = settings.availability;

                if (!start || isBefore(currentTime, start))
                    forbidden();  // the availability window isn't open yet
                if (!!end && isAfter(currentTime, end))
                    forbidden();  // the availability window has closed
            }
        }

        // -----------------------------------------------------------------------------------------
        // Process the update. There are two options: either they're interested, in which case all
        // appropriate fields must be set, or they're not interested, and everything will be NULL.
        // -----------------------------------------------------------------------------------------

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

        // -----------------------------------------------------------------------------------------
        // Store the actual update in the database.
        // -----------------------------------------------------------------------------------------

        const affectedRows = await dbInstance.insertInto(tHotelsPreferences)
            .set({
                userId: props.user.id,
                eventId: eventId,
                teamId: teamId,
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
};

/**
 * Zod type that describes the data required when updating their training preferences.
 */
const kUpdateTrainingPreferences = z.object({
    training: z.number(),
});

/**
 * Server action that enables volunteers to update their training preferences.
 */
export async function updateTrainingPreferences(eventId: number, teamId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateTrainingPreferences, async (data, props) => {
        const dbInstance = db;

        const verification = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .where(tUsersEvents.userId.equals(props.user.id))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .select({
                event: {
                    shortName: tEvents.eventShortName,
                    slug: tEvents.eventSlug,
                },
                settings: {
                    availability: {
                        start: tEvents.trainingPreferencesStart,
                        end: tEvents.trainingPreferencesEnd,
                    },
                    detailsPublished: tEvents.trainingInformationPublished,
                    eligible: tUsersEvents.trainingEligible.valueWhenNull(
                        tRoles.roleTrainingEligible),
                },
            })
            .executeSelectNoneOrOne();

        if (!verification)
            notFound();

        const { event, settings } = verification;

        // -----------------------------------------------------------------------------------------
        // Verify that the signed in user is able to update their preferences.
        // -----------------------------------------------------------------------------------------

        if (!props.access.can('event.trainings', { event: event.slug })) {
            if (!settings.detailsPublished || !settings.eligible)
                forbidden();  // the page shouldn't be accessible

            const currentTime = Temporal.Now.zonedDateTimeISO('utc');

            if (!!settings.availability) {
                const { start, end } = settings.availability;

                if (!start || isBefore(currentTime, start))
                    forbidden();  // the availability window isn't open yet
                if (!!end && isAfter(currentTime, end))
                    forbidden();  // the availability window has closed
            }
        }

        // -----------------------------------------------------------------------------------------
        // Store the actual update in the database.
        // -----------------------------------------------------------------------------------------

        let preferenceTrainingId: number | null = null;
        if (data.training >= 1)
            preferenceTrainingId = data.training;

        const affectedRows = await dbInstance.insertInto(tTrainingsAssignments)
            .set({
                eventId: eventId,
                assignmentUserId: props.user.id,
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
            return { success: false, error: 'Unable to update your preferences in the database…' };

        RecordLog({
            type: kLogType.ApplicationTrainingPreferences,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                event: event.shortName,
                training: data.training,
            },
        });

        return { success: true, refresh: true };
    });
}
