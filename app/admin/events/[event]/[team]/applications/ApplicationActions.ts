// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { Publish } from '@lib/subscriptions';
import { executeServerAction } from '@lib/serverAction';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEvent, getTeam } from '@lib/cache';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tTeams, tTeamsRoles, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus, kShirtFit, kShirtSize, kSubscriptionType } from '@lib/database/Types';
import { kServiceHoursProperty, kServiceTimingProperty } from '@app/registration/[slug]/application/ApplicationActions';

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Server action through which an application can be "claimed", marking it as being in progress so
 * that other people don't accidentally pick up the same application.
 */
export async function claimApplication(
    eventSlug: string, teamSlug: string, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event: eventSlug, team: teamSlug },
            },
        });

        const event = await getEvent(eventSlug);
        const team = await getTeam(teamSlug);

        if (!event || !team)
            notFound();

        const claimedByUsersJoin = tUsers.forUseInLeftJoinAs('cbuj');

        const dbInstance = db;
        const existingClaim = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .leftJoin(claimedByUsersJoin)
                .on(claimedByUsersJoin.userId.equals(tUsersEvents.registrationOwnerId))
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .select({
                name: tUsers.name,
                claimedBy: claimedByUsersJoin.name,
            })
            .executeSelectOne();

        const affectedRows = await dbInstance.update(tUsersEvents)
            .set({
                registrationOwnerId:
                    !!existingClaim.claimedBy ? null
                                              : props.user.id,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for(!!existingClaim.claimedBy ? 'ReleaseApplication'
                                                 : 'ClaimApplication')
            .withCondition(!!affectedRows)
            .withSeverity('Warning')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .record({
                event: event.shortName,
                team: team.name,
            });

        return {
            success: true,
            close: true,
            refresh: true,

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
    eventSlug: string, teamSlug: string, approved: boolean, userId: number,
    subject?: string, message?: string)
{
    'use server';
    return executeServerAction(new FormData, kNoDataRequired, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event: eventSlug, team: teamSlug },
            },
        });

        const event = await getEvent(eventSlug);
        const team = await getTeam(teamSlug);

        if (!event || !team)
            notFound();

        const isSilent = !subject || !message;
        if (isSilent) {
            if (!props.access.can('organisation.silent'))
                forbidden();

        } else {
            await sendCommunication({
                sender: props.user,
                recipient: userId,
                subject,
                message,
                metadata: {
                    eventId: event.id,
                    teamId: team.id,
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
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('DecideApplication')
            .withCondition(!!affectedRows)
            .withSeverity('Warning')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .record({
                event: event.shortName,
                team: team.title,
                verdict: approved ? 'Accepted' : 'Rejected',
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
export async function createApplication(eventSlug: string, teamSlug: string, formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateApplicationData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'create',
                scope: { event: eventSlug, team: teamSlug },
            },
        });

        const event = await getEvent(eventSlug);
        const team = await getTeam(teamSlug);

        if (!event || !team)
            return { success: false, error: 'Unable to identify the appropriate event or team…' };

        const dbInstance = db;
        const teamInfo = await dbInstance.selectFrom(tTeams)
            .innerJoin(tTeamsRoles)
                .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                    .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
            .where(tTeams.teamId.equals(team.id))
            .select({
                roleId: tTeamsRoles.roleId,
            })
            .executeSelectNoneOrOne();

        if (!teamInfo)
            return { success: false, error: 'Unable to identify the appropriate team role…' };

        const existingApplication = await dbInstance.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(data.userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .selectCountAll()
            .executeSelectNoneOrOne() ?? 0;

        if (existingApplication > 0)
            return { success: false, error: 'This volunteer already has an active application…' };

        const [ preferenceTimingStart, preferenceTimingEnd ] =
            data.serviceTiming.split('-').map(v => parseInt(v, 10));

        const affectedRows = await dbInstance.insertInto(tUsersEvents)
            .set({
                userId: data.userId,
                eventId: event.id,
                teamId: team.id,
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

        LogBuilder.for('CreateApplication')
            .withSeverity('Warning')
            .withInitiatorUser(props.user)
            .withAffectedUser(data.userId)
            .record({
                event: event.shortName,
                team: team.name,
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
    eventSlug: string, teamSlug: string, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kMoveApplicationData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'update',
                scope: { event: eventSlug, team: teamSlug },
            },
        });

        const event = await getEvent(eventSlug);
        const currentTeam = await getTeam(teamSlug);
        const targetTeam = await getTeam(data.team);

        if (!event || !currentTeam || !targetTeam)
            notFound();

        const existingApplication = await db.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(targetTeam.id))
            .selectCountAll()
            .executeSelectOne();

        if (!!existingApplication)
            return { success: false, error: 'They are already participating in that team…' };

        const affectedRows = await db.update(tUsersEvents)
            .set({
                teamId: targetTeam.id
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(currentTeam.id))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to move the application in the database…' };

        const targetUserName = await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(userId))
            .selectOneColumn(tUsers.name)
            .executeSelectNoneOrOne();

        if (!targetUserName)
            notFound();

        await Publish({
            type: kSubscriptionType.Application,
            typeId: targetTeam.id,
            sourceUserId: userId,
            message: {
                userId: userId,
                name: targetUserName,
                event: event.shortName,
                eventSlug: event.slug,
                teamEnvironment: targetTeam.domain,
                teamName: targetTeam.title,
                teamSlug: targetTeam.slug,
                teamTitle: targetTeam.name,
            },
        });

        LogBuilder.for('MoveApplication')
            .withSeverity('Warning')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .record({
                team: targetTeam.title,
            });

        return { success: true, refresh: true };
    });
}

/**
 * Server action that should be called when a previously rejected application should be reconsidered
 */
export async function reconsiderApplication(
    eventSlug: string, teamSlug: string, userId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.applications',
                operation: 'create',
                scope: { event: eventSlug, team: teamSlug },
            },
        });

        const event = await getEvent(eventSlug);
        const team = await getTeam(teamSlug);

        if (!event || !team)
            notFound();

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationStatus: kRegistrationStatus.Registered
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('ReconsiderApplication')
            .withCondition(!!affectedRows)
            .withSeverity('Warning')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .record({
                event: event.shortName,
                team: team.title,
            });

        return { success: true };
    });
}
