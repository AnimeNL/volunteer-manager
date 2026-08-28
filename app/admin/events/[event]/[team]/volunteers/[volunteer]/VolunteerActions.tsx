// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/LogBuilder';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import { executeServerAction } from '@lib/serverAction';
import db, { tRoles, tTeamsRoles, tUsersEvents } from '@lib/database';

/**
 * Cancels the volunteer's participation.
 */
export async function cancelParticipation(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction({ /* no data */ }, z.object({ /* none */ }), async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        return {
            success: false,
            error: 'Not yet implemented',
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

});

/**
 * Changes the volunteer's team for this event.
 */
export async function changeTeam(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kChangeTeamSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        return {
            success: false,
            error: 'Not yet implemented',
        };
    });
}

/**
 * Reinstates the volunteer's participation.
 */
export async function reinstateParticipation(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction({ /* no data */ }, z.object({ /* none */ }), async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        return {
            success: false,
            error: 'Not yet implemented',
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
