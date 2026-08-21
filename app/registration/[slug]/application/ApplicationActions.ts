// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { Publish } from '@lib/subscriptions';
import { RecordLog, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { determineAvailabilityStatus } from '@lib/EnvironmentContext';
import { executeServerAction } from '@lib/serverAction';
import { getStaticContent } from '@lib/Content';
import { readSetting } from '@lib/Settings';
import db, { tEnvironments, tEnvironmentsEvents, tEvents, tEventsTeams, tTeams, tTeamsRoles,
    tUsersCommunication, tUsersEvents, tUsersEventsPreferencesParticipation }
        from '@lib/database';

import { kRegistrationStatus, kShirtFit, kShirtSize, kSubscriptionType } from '@lib/database/Types';

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
    includeCreditReel: z.boolean(),
    includeSocialMedia: z.boolean(),
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

        const environmentsEventsJoin = tEnvironmentsEvents.forUseInLeftJoin();

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
            .leftJoin(environmentsEventsJoin)
                .on(environmentsEventsJoin.environmentId.equals(tTeams.teamEnvironmentId))
                    .and(environmentsEventsJoin.eventId.equals(eventId))
            .where(tTeams.teamId.equals(teamId))
                .and(tTeams.teamDeleted.isNull())
            .select({
                defaultRoleId: tTeamsRoles.roleId,
                domain: tEnvironments.environmentDomain,
                name: tTeams.teamName,
                slug: tTeams.teamSlug,
                title: tTeams.teamTitle,
                emailAccountId: tTeams.teamEmailAccountId,

                acceptApplicationsWindow: {
                    start: environmentsEventsJoin.environmentAcceptApplicationsStart,
                    end: environmentsEventsJoin.environmentAcceptApplicationsEnd,
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
            ...teamInfo.acceptApplicationsWindow,
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

        const communicationId = await dbInstance.transaction(async () => {
            await dbInstance.insertInto(tUsersEvents)
                .set({
                    userId: props.user!.id,
                    eventId,
                    teamId,
                    roleId: teamInfo.defaultRoleId,
                    registrationDate: dbInstance.currentZonedDateTime(),
                    registrationStatus: kRegistrationStatus.Registered,
                    preferenceHours: parseInt(data.serviceHours, 10),
                    preferenceTimingStart, preferenceTimingEnd,
                    preferences: data.preferences,
                    preferencesUpdated: dbInstance.currentZonedDateTime(),
                    fullyAvailable: data.availability ? 1 : 0,
                })
                .executeInsert();

            await dbInstance.insertInto(tUsersEventsPreferencesParticipation)
                .set({
                    userId: props.user!.id,
                    eventId,
                    preferenceVersion: dbInstance.currentZonedDateTime(),
                    preferenceVersionIsLatest: 1,
                    preferenceVersionUserId: props.user!.id,
                    participationIncludeCreditReel: data.includeCreditReel ? 1 : 0,
                    participationIncludeSocialMedia: data.includeSocialMedia ? 1 : 0,
                    participationTshirtFit: data.tshirtFit,
                    participationTshirtSize: data.tshirtSize,
                })
                .executeInsert();

            const roleAccount = await readSetting('system-role-account-user-id');

            return await dbInstance.insertInto(tUsersCommunication)
                .set({
                    userId: props.user!.id,
                    communicationEventId: eventId,
                    communicationTeamId: teamId,
                    communicationSenderId: roleAccount ?? 0,
                    communicationDate: dbInstance.currentZonedDateTime()
                })
                .returningLastInsertedId()
                .executeInsert();
        });

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
                disableJsx: true,
                substitutions: {
                    event: eventInfo.shortName,
                    eventSlug: eventInfo.slug,
                    hostname: teamInfo.domain,
                    name: props.user.nameOrFirstName,
                    team: teamInfo.name,
                },
            });

        if (applicationConfirmation) {
            await SendEmailTask.Schedule({
                accountId: teamInfo.emailAccountId,
                sender: `AnimeCon ${teamInfo.title}`,
                message: {
                    to: props.user.username!,
                    subject: applicationConfirmation.title,
                    markdown: applicationConfirmation.markdown,
                },
                attribution: {
                    communicationId,
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
