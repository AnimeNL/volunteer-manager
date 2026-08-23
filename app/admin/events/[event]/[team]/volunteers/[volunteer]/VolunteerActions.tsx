// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tUsersEvents } from '@lib/database';
import { LogBuilder } from '@lib/log/LogBuilder';

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

});

/**
 * Changes the volunteer's role within their team for this event.
 */
export async function changeRole(
    userId: number, eventSlug: string, teamSlug: string, formData: unknown)
{
    return executeServerAction(formData, kChangeRoleSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug);

        return {
            success: false,
            error: 'Not yet implemented',
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
            props.authenticationContext, eventSlug, teamSlug);

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
