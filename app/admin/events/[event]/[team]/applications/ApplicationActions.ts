// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, unauthorized } from 'next/navigation';
import { z } from 'zod';

import { Publish } from '@lib/subscriptions';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { executeServerAction } from '@lib/serverAction';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEnvironments, tEvents, tTeams, tTeamsRoles, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus, kShirtFit, kShirtSize, kSubscriptionType } from '@lib/database/Types';
import { kServiceHoursProperty, kServiceTimingProperty } from '@app/api/event/application';


/**
 * Fetches the unique ID of the event identified by the given `event` slug.
 */
async function getEventId(event: string): Promise<number | undefined> {
    return await db.selectFrom(tEvents)
        .where(tEvents.eventSlug.equals(event))
        .selectOneColumn(tEvents.eventId)
        .executeSelectNoneOrOne() ?? undefined;
}

/**
 * Fetches the unique ID of the team identified by the given `team` slug.
 */
async function getTeamId(team: string): Promise<number | undefined> {
    return await db.selectFrom(tTeams)
        .where(tTeams.teamSlug.equals(team))
        .selectOneColumn(tTeams.teamId)
        .executeSelectNoneOrOne() ?? undefined;
}

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Zod type that describes that an application decision has been made.
 */
const kApplicationDecisionData = z.object({
    subject: z.string().optional(),
    message: z.string().optional(),
});

/**
 * Server action that should be called when a decision regarding an application has been made. The
 * `approved` boolean indicates whether the application was approved or not.
 */
export async function decideApplication(
    event: string, team: string, approved: boolean, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kApplicationDecisionData, async (data, props) => {
        const { access } = await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event, team },
            },
        });

        if (!props.user)
            unauthorized();

        const eventId = await getEventId(event);
        const teamId = await getTeamId(team);

        if (!eventId || !teamId)
            notFound();

        if (!data.subject || !data.message) {
            if (!access.can('volunteer.silent'))
                forbidden();
        } else {
            const username = await db.selectFrom(tUsers)
                .where(tUsers.userId.equals(userId))
                .selectOneColumn(tUsers.username)
                .executeSelectNoneOrOne();

            if (!username)
                forbidden();

            await SendEmailTask.Schedule({
                sender: `${props.user.firstName} ${props.user.lastName} (AnimeCon)`,
                message: {
                    to: username,
                    subject: data.subject,
                    markdown: data.message,
                },
                attribution: {
                    sourceUserId: props.user.userId,
                    targetUserId: userId,
                },
            });
        }

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationStatus:
                    approved ? kRegistrationStatus.Accepted
                             : kRegistrationStatus.Rejected
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the update in the database…' };

        RecordLog({
            type: kLogType.AdminUpdateTeamVolunteerStatus,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                action: approved ? 'Approved' : 'Rejected',
                event, eventId, teamId,
            },
        });

        return { success: true };
    });
}

/**
 * Zod type that describes the data required to create a new application.
 */
const kCreateApplicationData = z.object({
    userId: z.number(),
    tshirtSize: z.nativeEnum(kShirtSize),
    tshirtFit: z.nativeEnum(kShirtFit),
    serviceHours: kServiceHoursProperty,
    serviceTiming: kServiceTimingProperty,
    preferences: z.string().optional(),
});

/**
 * Server action that should be called when a new application should be created.
 */
export async function createApplication(event: string, team: string, formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateApplicationData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'create',
                scope: { event, team },
            },
        });

        const eventId = await getEventId(event);
        if (!eventId)
            return { success: false, error: 'Unable to identify the appropriate event…' };

        const dbInstance = db;
        const teamInfo = await dbInstance.selectFrom(tTeams)
            .innerJoin(tTeamsRoles)
                .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                    .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
            .where(tTeams.teamSlug.equals(team))
            .select({
                id: tTeams.teamId,
                roleId: tTeamsRoles.roleId,
            })
            .executeSelectNoneOrOne();

        if (!teamInfo)
            return { success: false, error: 'Unable to identify the appropriate team…' };

        const existingApplication = await dbInstance.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(data.userId))
                .and(tUsersEvents.eventId.equals(eventId))
            .selectCountAll()
            .executeSelectNoneOrOne() ?? 0;

        if (existingApplication > 0)
            return { success: false, error: 'This volunteer already has an active application…' };

        const [ preferenceTimingStart, preferenceTimingEnd ] =
            data.serviceTiming.split('-').map(v => parseInt(v, 10));

        const affectedRows = await dbInstance.insertInto(tUsersEvents)
            .set({
                userId: data.userId,
                eventId: eventId,
                teamId: teamInfo.id,
                roleId: teamInfo.roleId,
                registrationDate: dbInstance.currentZonedDateTime(),
                registrationStatus: kRegistrationStatus.Registered,
                shirtFit: data.tshirtFit,
                shirtSize: data.tshirtSize,
                preferenceHours: parseInt(data.serviceHours, 10),
                preferenceTimingStart, preferenceTimingEnd,
                preferences: data.preferences,
                preferencesUpdated: dbInstance.currentZonedDateTime(),
                fullyAvailable: 1,
                includeCredits: 1,
                includeSocials: 1,
            })
            .executeInsert();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the application in the database…' };

        RecordLog({
            type: kLogType.AdminEventApplication,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: data.userId,
            data: {
                event,
                team,
            }
        });

        return {
            success: true,
            refresh: true,
        };
    });
}

/**
 * Zod type that describes the data required to move an application.
 */
const kMoveApplicationData = z.object({
    team: z.string(),
});

/**
 * Server action that should be called when an application should be moved to another team.
 */
export async function moveApplication(
    event: string, team: string, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kMoveApplicationData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event, team },
            },
        });

        const eventId = await getEventId(event);

        const currentTeamId = await getTeamId(team);
        const targetTeamId = await getTeamId(data.team);

        if (!eventId || !currentTeamId || !targetTeamId)
            notFound();

        const existingApplication = await db.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(targetTeamId))
            .selectCountAll()
            .executeSelectOne();

        if (!!existingApplication)
            return { success: false, error: 'They are already participating in that team…' };

        const targetTeam = await db.selectFrom(tTeams)
            .innerJoin(tEnvironments)
                .on(tEnvironments.environmentId.equals(tTeams.teamEnvironmentId))
            .where(tTeams.teamId.equals(targetTeamId))
            .select({
                environment: tEnvironments.environmentDomain,
                name: tTeams.teamName,
                slug: tTeams.teamSlug,
                title: tTeams.teamTitle,
            })
            .executeSelectNoneOrOne();

        if (!targetTeam)
            notFound();

        const affectedRows = await db.update(tUsersEvents)
            .set({
                teamId: targetTeamId
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(currentTeamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to move the application in the database…' };

        const shouldPublish = await readSetting('application-publish-on-move');
        if (!!shouldPublish) {
            const targetEvent = await db.selectFrom(tEvents)
                .where(tEvents.eventId.equals(eventId))
                .select({
                    shortName: tEvents.eventShortName,
                    slug: tEvents.eventSlug,
                })
                .executeSelectNoneOrOne();

            const targetUserName = await db.selectFrom(tUsers)
                .where(tUsers.userId.equals(userId))
                .selectOneColumn(tUsers.name)
                .executeSelectNoneOrOne();

            if (!targetEvent || !targetUserName)
                notFound();

            await Publish({
                type: kSubscriptionType.Application,
                typeId: targetTeamId,
                sourceUserId: userId,
                message: {
                    userId: userId,
                    name: targetUserName,
                    event: targetEvent.shortName,
                    eventSlug: targetEvent.slug,
                    teamEnvironment: targetTeam.environment,
                    teamName: targetTeam.name,
                    teamSlug: targetTeam.slug,
                    teamTitle: targetTeam.title,
                },
            });
        }

        RecordLog({
            type: kLogType.AdminEventApplicationMove,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                team: targetTeam.name,
            },
        });

        return { success: true, refresh: true };
    });
}

/**
 * Server action that should be called when a previously rejected application should be reconsidered
 */
export async function reconsiderApplication(
    event: string, team: string, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'create',
                scope: { event, team },
            },
        });

        const eventId = await getEventId(event);
        const teamId = await getTeamId(team);

        if (!eventId || !teamId)
            notFound();

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationStatus: kRegistrationStatus.Registered
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the update in the database…' };

        RecordLog({
            type: kLogType.AdminUpdateTeamVolunteerStatus,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                action: 'Reset',
                event, eventId, teamId,
            },
        });

        return { success: true };
    });
}
