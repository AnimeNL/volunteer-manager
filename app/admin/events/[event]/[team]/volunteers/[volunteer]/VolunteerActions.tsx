// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/LogBuilder';
import { executeServerAction } from '@lib/serverAction';
import { getTeam } from '@lib/cache';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tRoles, tTeamsRoles, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Zod type defining the schema for cancelling or reinstating a volunteer's participation.
 */
const kParticipationActionSchema = z.object({
    message: z.string().optional(),
    subject: z.string().optional(),
});

/**
 * Updates the volunteer's participation status (e.g. Cancelled or Accepted).
 */
export async function updateVolunteerStatus(
    userId: number, eventSlug: string, teamSlug: string,
    status: typeof kRegistrationStatus.Accepted | typeof kRegistrationStatus.Cancelled,
    formData: unknown)
{
    const isCancelled = status === kRegistrationStatus.Cancelled;

    return executeServerAction(formData, kParticipationActionSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.applications',
                operation: 'update',
            });

        const isSilent = !data.subject || !data.message;
        if (isSilent) {
            if (!props.access.can('organisation.silent'))
                forbidden();

        } else {
            await sendCommunication({
                sender: props.user,
                recipient: userId,
                subject: data.subject!,
                message: data.message!,
                metadata: {
                    eventId: event.id,
                    teamId: team.id,
                    promptId: isCancelled ? 'participation-cancelled' : 'participation-reinstated',
                },
            });
        }

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationStatus: status,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('UpdateVolunteerStatus')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user.id)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                action: isCancelled ? 'Cancelled' : 'Reinstated',
                event: event.shortName,
                team: team.title,
            });

        const message = isCancelled
            ? isSilent ? 'Their participation has been cancelled silently.'
                       : 'The e-mail has been sent and their participation has been cancelled.'
            : isSilent ? 'They have been reinstated silently.'
                       : 'The e-mail has been sent and they have been reinstated.';

        return {
            success: true,
            refresh: true,
            message,
        };
    });
}

/**
 * Zod type defining the schema for changing a volunteer's role.
 */
const kChangeRoleSchema = z.object({
    role: z.coerce.number(),
});

/**
 * Changes the volunteer's role within their team for this event.
 */
export async function changeRole(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kChangeRoleSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        const role = await db.selectFrom(tTeamsRoles)
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tTeamsRoles.roleId))
            .where(tTeamsRoles.teamId.equals(team.id))
                .and(tTeamsRoles.roleId.equals(data.role))
            .select({
                id: tRoles.roleId,
                name: tRoles.roleName,
            })
            .executeSelectNoneOrOne();

        if (!role)
            return { success: false, error: 'That role is not valid for this team.' };

        const affectedRows = await db.update(tUsersEvents)
            .set({
                roleId: data.role,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('UpdateVolunteerRole')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user.id)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                role: role.name,
                team: team.title,
            });

        return {
            success: true,

            close: true,
            refresh: true,
        };
    });
}

/**
 * Zod type defining the schema for changing a volunteer's team.
 */
const kChangeTeamSchema = z.object({
    message: z.string().optional(),
    subject: z.string().optional(),
    team: z.string(),
});

/**
 * Changes the volunteer's team for this event.
 */
export async function changeTeam(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kChangeTeamSchema, async (data, props) => {
        const { event, team: currentTeam } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        const targetTeam = await getTeam(data.team);
        if (!targetTeam)
            return { success: false, error: 'The selected team does not exist.' };

        const teamRole = await db.selectFrom(tTeamsRoles)
            .where(tTeamsRoles.teamId.equals(targetTeam.id))
                .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
            .select({
                roleId: tTeamsRoles.roleId,
            })
            .executeSelectOne();

        const existingApplication = await db.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(targetTeam.id))
            .selectCountAll()
            .executeSelectOne();

        if (existingApplication > 0)
            return { success: false, error: 'This volunteer already participates in that team.' };

        const isSilent = !data.subject || !data.message;
        if (isSilent) {
            if (!props.access.can('organisation.silent'))
                forbidden();

        } else {
            await sendCommunication({
                sender: props.user,
                recipient: userId,
                subject: data.subject!,
                message: data.message!,
                metadata: {
                    eventId: event.id,
                    teamId: targetTeam.id,
                    promptId: 'team-change',
                },
            });
        }

        const affectedRows = await db.update(tUsersEvents)
            .set({
                teamId: targetTeam.id,
                roleId: teamRole.roleId,
                registrationStatus: kRegistrationStatus.Accepted,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(currentTeam.id))
            .executeUpdate();

        LogBuilder.for('UpdateVolunteerTeam')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user.id)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                sourceTeam: currentTeam.name,
                targetTeam: targetTeam.name,
            });

        return {
            success: true,
            redirect: `/admin/events/${eventSlug}/${targetTeam.slug}/volunteers/${userId}`,
        };
    });
}


/**
 * Zod type describing the schema for updating volunteer notes.
 */
const kUpdateNotesSchema = z.object({
    notes: z.string().optional(),
});

/**
 * Updates the team-specific notes associated with this volunteer.
 */
export async function updateNotes(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kUpdateNotesSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.volunteers.information',
                operation: 'update',
            });

        const affectedRows = await db.update(tUsersEvents)
            .set({
                registrationNotes: data.notes,
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('UpdateVolunteerNotes')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user.id)
            .withAffectedUser(userId)
            .record({
                event: event.shortName,
                team: team.title,
            });

        return { success: true };
    });
}

/**
 * Zod type describing the schema for updating overrides.
 */
const kUpdateOverridesSchema = z.object({
    timeslotLimit: z.number().min(0).max(99).nullish(),
    hotelEligible: z.literal([ 0, 1, /* reset= */ '' ]).nullish(),
    trainingEligible: z.literal([ 0, 1, /* reset= */ '' ]).nullish(),
});

/**
 * Updates the overrides applied to the volunteer's participation.
 */
export async function updateOverrides(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kUpdateOverridesSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, 'event.volunteers.overrides');

        const availabilityEventLimit = data.timeslotLimit ?? null;
        const hotelEligible = data.hotelEligible === '' ? null : data.hotelEligible;
        const trainingEligible = data.trainingEligible === '' ? null : data.trainingEligible;

        const affectedRows = await db.update(tUsersEvents)
            .set({
                availabilityEventLimit,
                hotelEligible,
                trainingEligible
            })
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('UpdateApplicationOverrides')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user.id)
            .withAffectedUser(userId)
            .withSeverity('Error')
            .record({
                event: event.shortName,
            });

        return {
            success: true,
            message: 'The overrides have been updated.',
        };
    });
}
