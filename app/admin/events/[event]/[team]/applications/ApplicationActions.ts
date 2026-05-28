// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { Publish } from '@lib/subscriptions';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeServerAction } from '@lib/serverAction';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tEnvironments, tEvents, tTeams, tTeamsRoles, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus, kShirtFit, kShirtSize, kSubscriptionType } from '@lib/database/Types';
import { kServiceHoursProperty, kServiceTimingProperty } from '@app/registration/[slug]/application/ApplicationActions';

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
 * Server action through which an application can be "claimed", marking it as being in progress so
 * that other people don't accidentally pick up the same application.
 */
export async function claimApplication(
    event: string, team: string, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event, team },
            },
        });

        const eventId = await getEventId(event);
        const teamId = await getTeamId(team);

        if (!eventId || !teamId)
            notFound();

        const claimedByUsersJoin = tUsers.forUseInLeftJoinAs('cbuj');

        const dbInstance = db;
        const existingClaim = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .leftJoin(claimedByUsersJoin)
                .on(claimedByUsersJoin.userId.equals(tUsersEvents.registrationOwnerId))
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .select({
                name: tUsers.name,
                claimedBy: claimedByUsersJoin.name,
            })
            .executeSelectOne();

        await dbInstance.update(tUsersEvents)
            .set({
                registrationOwnerId:
                    !!existingClaim.claimedBy ? null
                                              : props.user.id,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.teamId.equals(teamId))
            .executeUpdate();

        RecordLog({
            type:
                !!existingClaim.claimedBy ? kLogType.AdminEventApplicationRelease
                                          : kLogType.AdminEventApplicationClaim,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: userId,
            data: {
                event, team,
            },
        });

        return {
            success: true,
            close: true,

            message:
                `The application has been ${!!existingClaim.claimedBy ? 'released' : 'claimed'}`,
        };
    });
}

/**
 * Server action that should be called when a decision regarding an application has been made. The
 * `approved` boolean indicates whether the application was approved or not.
 */
export async function decideApplication(
    event: string, team: string, approved: boolean, userId: number,
    subject?: string, message?: string)
{
    'use server';
    return executeServerAction(new FormData, kNoDataRequired, async (data, props) => {
        const { access } = await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event, team },
            },
        });

        const eventId = await getEventId(event);
        const teamId = await getTeamId(team);

        if (!eventId || !teamId)
            notFound();

        const isSilent = !subject || !message;
        if (isSilent) {
            if (!access.can('organisation.silent'))
                forbidden();

        } else {
            await sendCommunication({
                sender: props.user,
                recipient: userId,
                subject,
                message,
                metadata: {
                    eventId,
                    teamId,
                    promptId: approved ? 'application-approved' : 'application-rejected',
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

        return {
            success: true,
            refresh: true,
            message: approved
                ? isSilent ? 'The application has been approved silently.'
                           : 'The e-mail has been sent and the application has been approved.'
                : isSilent ? 'The application has been rejected silently.'
                           : 'The e-mail has been sent and the application has been rejected.',
        };
    });
}

/**
 * Zod type that describes the data required to create a new application.
 */
const kCreateApplicationData = z.object({
    userId: z.number(),
    tshirtSize: z.enum(kShirtSize),
    tshirtFit: z.enum(kShirtFit),
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
                .and(tUsersEvents.teamId.equals(teamInfo.id))
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
