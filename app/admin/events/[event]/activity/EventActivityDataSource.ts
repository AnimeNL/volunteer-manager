// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ExtractRowModel } from '@app/admin/components/DataTable';
import { createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tTeams, tUsers, tUsersEvents, tUsersEventsPreferencesAvailability,
    tUsersEventsPreferencesHotel, tUsersEventsPreferencesParticipation,
    tUsersEventsPreferencesRefunds, tUsersEventsPreferencesTraining } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Definition of the preference tables that will be queried for volunteer changes.
 */
const kPreferenceTables = [
    {
        table: tUsersEventsPreferencesAvailability,
        type: 'Availability',
        description: 'Updated their availability',
    },
    {
        table: tUsersEventsPreferencesHotel,
        type: 'Hotel',
        description: 'Updated their hotel preferences',
    },
    {
        table: tUsersEventsPreferencesParticipation,
        type: 'Participation',
        description: 'Updated their participation preferences',
    },
    {
        table: tUsersEventsPreferencesRefunds,
        type: 'Refunds',
        description: 'Requested a ticket refund',
    },
    {
        table: tUsersEventsPreferencesTraining,
        type: 'Training',
        description: 'Updated their training preferences',
    },
] as const;

/**
 * Data source for volunteer activity and preference changes during an event.
 */
export const eventActivityDataSource = createDataSource('admin/event/activity', withContext({
    /**
     * Event for which activity is being retrieved.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the activity entry.
     */
    id: z.string(),

    /**
     * Account information of the volunteer who made the change.
     */
    user: z.object({
        id: z.number(),
        name: z.string(),
        firstName: z.string(),
    }),

    /**
     * Name of the team they are part of.
     */
    team: z.string(),

    /**
     * Colour that represents the team's identity.
     */
    teamColour: z.string(),

    /**
     * The type of change that occurred.
     */
    type: z.string(),

    /**
     * Description of the change that occurred.
     */
    description: z.string(),

    /**
     * URL that the activity entry should link to.
     */
    href: z.string(),

    /**
     * Date and time at which the change was made.
     */
    date: z.string(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.visible',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        const dbInstance = db;

        const preferenceQueries = kPreferenceTables.map(async ({ table, type, description }) => {
            const rows = await dbInstance.selectFrom(table)
                .innerJoin(tUsersEvents)
                    .on(tUsersEvents.eventId.equals(table.eventId))
                    .and(tUsersEvents.userId.equals(table.userId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .innerJoin(tUsers)
                    .on(tUsers.userId.equals(table.userId))
                .innerJoin(tTeams)
                    .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .where(table.eventId.equals(context.event.id))
                .select({
                    date: dbInstance.dateTimeAsString(table.preferenceVersion),
                    team: tTeams.teamName,
                    teamColour: tTeams.teamColourLightTheme,
                    teamSlug: tTeams.teamSlug,
                    user: {
                        id: tUsers.userId,
                        name: tUsers.name,
                        firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                    },
                })
                .executeSelectMany();

            return rows.map(row => ({
                id: `${type}-${row.user.id}-${row.date}`,
                user: row.user,
                team: row.team,
                teamColour: row.teamColour,
                type,
                description,
                href: `/admin/events/${context.event.slug}/${row.teamSlug}/volunteers/${row.user.id}`,
                date: row.date,
            }));
        });

        const applicationQuery = (async () => {
            const rows = await dbInstance.selectFrom(tUsersEvents)
                .innerJoin(tUsers)
                    .on(tUsers.userId.equals(tUsersEvents.userId))
                .innerJoin(tTeams)
                    .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .where(tUsersEvents.eventId.equals(context.event.id))
                    .and(tUsersEvents.registrationDate.isNotNull())
                .select({
                    date: dbInstance.dateTimeAsString(tUsersEvents.registrationDate),
                    team: tTeams.teamName,
                    teamColour: tTeams.teamColourLightTheme,
                    teamSlug: tTeams.teamSlug,
                    user: {
                        id: tUsers.userId,
                        name: tUsers.name,
                        firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                    },
                })
                .executeSelectMany();

            return rows.map(row => ({
                id: `Application-${row.user.id}-${row.date}`,
                user: row.user,
                team: row.team,
                teamColour: row.teamColour,
                type: 'Application',
                description: `Applied to join the ${row.team}`,
                href: `/admin/events/${context.event.slug}/${row.teamSlug}/applications`,
                date: row.date!,
            }));
        })();

        const results = await Promise.all([ ...preferenceQueries, applicationQuery ]);
        const allRows = results.flat();

        const sorted = allRows.sort((lhs, rhs) => {
            let comparison = 0;
            const field = params.sort.field;

            if (field === 'user') {
                comparison = lhs.user.name.localeCompare(rhs.user.name);
            } else if (field === 'type') {
                comparison = lhs.type.localeCompare(rhs.type);
            } else if (field === 'description') {
                comparison = lhs.description.localeCompare(rhs.description);
            } else if (field === 'team') {
                comparison = lhs.team.localeCompare(rhs.team);
            } else {
                comparison = lhs.date.localeCompare(rhs.date);
            }

            return params.sort.direction === 'asc' ? comparison : -comparison;
        });

        const paginated = sorted.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: sorted.length,
            rows: paginated,
        };
    },
});

/**
 * Type definition for the EventActivityRowModel.
 */
export type EventActivityRowModel = ExtractRowModel<typeof eventActivityDataSource>;
