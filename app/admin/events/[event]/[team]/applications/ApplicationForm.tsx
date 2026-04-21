// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ApplicationFormClient } from './ApplicationFormClient';
import db, { tUsers, tUsersEvents } from '@lib/database';

/**
 * Props accepted by the <ApplicationForm> component.
 */
interface ApplicationFormProps {
    /**
     * Unique ID of the event for which applications could be considered.
     */
    eventId: number;

    /**
     * Unique ID of the team for which applications could be considered.
     */
    teamId: number;
}

/**
 * The <ApplicationForm> component displays the application form. It comes in a server-side
 * component for fetching the necessary data, and a client-side component for the interaction.
 *
 * MUI deduplicates the input field's suggestions based on their label, which is the incorrect
 * behaviour since we may have multiple volunteers with the same name. For that reason we do our
 * own processing step in which we append the unique user ID to names that have already been seen.
 */
export async function ApplicationForm(props: ApplicationFormProps) {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const volunteers = await db.selectFrom(tUsers)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
                .and(usersEventsJoin.eventId.equals(props.eventId))
                .and(usersEventsJoin.teamId.equals(props.teamId))
        .where(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            label: tUsers.name,
            disabled: db.countDistinct(usersEventsJoin.teamId).greaterOrEquals(1),
        })
        .groupBy(tUsers.userId)
        .orderBy('label', 'asc')
        .executeSelectMany();

    const seenVolunteers = new Set;
    const deduplicatedVolunteers = volunteers.map(volunteer => {
        const label =
            seenVolunteers.has(volunteer.label)
                ? `${volunteer.label} (#${volunteer.id})`
                : volunteer.label;

        seenVolunteers.add(volunteer.label);

        return {
            ...volunteer,
            label,
        };
    });

    return (
        <ApplicationFormClient name="userId" label="Volunteer" required
                               options={deduplicatedVolunteers} matchId
                               autocompleteProps={{ fullWidth: true, size: 'small' }} />
    );
}
