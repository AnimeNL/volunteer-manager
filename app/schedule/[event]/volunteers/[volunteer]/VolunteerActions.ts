// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log';
import { executeServerAction } from '@lib/serverAction';
import { getTeam } from '@lib/cache';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';
import db, { tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Zod type that describes the data required when updating a volunteer's notes.
 */
const kUpdateVolunteerNotesData = z.object({
    /**
     * Unique slug of the event with which the notes should be associated.
     */
    event: z.string().nonempty(),

    /**
     * Unique ID of the user whose notes should be updated.
     */
    userId: z.number(),

    /**
     * The notes as they should be stored in the database. May be empty.
     */
    notes: z.string(),
});

/**
 * Server Action through which the notes associated with a volunteer can be updated.
 */
export async function updateVolunteerNotes(formData: unknown) {
    return executeServerAction(formData, kUpdateVolunteerNotesData, async (data, props) => {
        // Intentionally checks `read` at event scope so leaders who can view volunteer notes in
        // the schedule app can also update them across teams.
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event, {
                permission: 'volunteers.participation',
                operation: 'read',
            });

        const dbInstance = db;
        const teamId = await dbInstance.selectFrom(tUsersEvents)
            .where(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.userId.equals(data.userId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .selectOneColumn(tUsersEvents.teamId)
            .limit(1)
            .executeSelectNoneOrOne();

        const team = teamId ? await getTeam(teamId) : undefined;
        if (!team)
            notFound();

        const affectedRows = await dbInstance.update(tUsersEvents)
            .set({
                registrationNotes: data.notes.length ? data.notes : null,
            })
            .where(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.userId.equals(data.userId))
                .and(tUsersEvents.teamId.equals(team.id))
            .executeUpdate();

        LogBuilder.for('UpdateVolunteerNotes')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(data.userId)
            .record({
                event: event.shortName,
                team: team.title,
            });

        return { success: true };
    });
}
