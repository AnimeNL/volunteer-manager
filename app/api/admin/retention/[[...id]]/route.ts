// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { LogSeverity, LogType, Log } from '@lib/Log';
import { RegistrationStatus } from '@lib/database/Types';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import { noAccess } from '@app/api/Action';
import { readSetting } from '@lib/Settings';
import db, { tEvents, tRetention, tTeams, tUsersEvents, tUsers } from '@lib/database';

/**
 * Row model for an individual piece of advice offered by Del a Rie Advies.
 */
const kRetentionRowModel = z.object({
    /**
     * Unique ID assigned to this person in the retention table.
     */
    id: z.number(),

    /**
     * Name of the volunteer for whom retention is being considered.
     */
    name: z.string(),

    /**
     * The most recent event that this volunteer participated in.
     */
    latestEvent: z.string().optional(),

    /**
     * Slug of the most recent event that the volunteer participated in.
     */
    latestEventSlug: z.string().optional(),

    /**
     * Status of this volunteer in regards to retention planning.
     */
    status: z.enum([ 'Unknown', 'Contacting', 'Declined', 'Applied', 'Retained' ]),

    /**
     * Slug of the team they have applied to if they participate in this event.
     */
    statusTeam: z.string().optional(),

    /**
     * Name of the lead who is pursuing contacting this volunteer.
     */
    assigneeName: z.string().optional(),

    /**
     * Notes that were written by that lead regarding contacting this person.
     */
    notes: z.string().optional(),
});

/**
 * The context required by the retention mechanism.
 */
const kRetentionContext = z.object({
    context: z.object({
        /**
         * Slug of the event for which retention is being managed.
         */
        event: z.string(),

        /**
         * Slug of the team for which retention is being managed.
         */
        team: z.string(),
    }),
});

/**
 * Context required by the retention management mechanism.
 */
export type RetentionContext = z.infer<typeof kRetentionContext>['context'];

/**
 * Export type definitions so that the Retention DataTable API can be used in `callApi()`.
 */
export type RetentionEndpoints =
    DataTableEndpoints<typeof kRetentionRowModel, typeof kRetentionContext>;

/**
 * Export type definition for the Retention DataTable API's Row Model.
 */
export type RetentionRowModel = z.infer<typeof kRetentionRowModel>;

/**
 * The table will first be sorted by status, and this record decides the actual order.
 */
const kRetentionSortOrder = {
    // Not started:
    'Unknown': 0,

    // In progress:
    'Contacting': 2,
    'Applied': 3,

    // Finished:
    'Retained': 4,
    'Declined': 5,
};

/**
 * Returns the event instance and the teamId based on the given `context`.
 */
async function getEventAndTeamId(context: RetentionContext) {
    const event = await getEventBySlug(context.event);
    const teamId = await db.selectFrom(tTeams)
        .selectOneColumn(tTeams.teamId)
        .where(tTeams.teamSlug.equals(context.team))
        .executeSelectNoneOrOne();

    if (!event || !teamId)
        return undefined;

    return { event, teamId };
}

/**
 * The Retention API is implemented as a regular, editable DataTable API.
 */
export const { GET, PUT } = createDataTableApi(kRetentionRowModel, kRetentionContext, {
    accessCheck({ context }, action, props) {
        switch (action) {
            case 'create':
            case 'delete':
            case 'get':
                noAccess();

            case 'list':
            case 'update':
                executeAccessCheck(props.authenticationContext, {
                    check: 'admin-event',
                    event: context.event,

                    permission: {
                        permission: 'event.retention',
                        options: {
                            event: context.event,
                            team: context.team,
                        },
                    },
                });

                break;
        }
    },

    // Note: This display does not support either pagination or sorting because of the data model,
    // and the slim chance that this will provide benefits when displaying the data.
    async list({ context }) {
        const eventAndTeamId = await getEventAndTeamId(context);
        if (!eventAndTeamId)
            notFound();

        const { event, teamId } = eventAndTeamId;

        const numHistoricEventsToConsider =
            await readSetting('retention-number-of-events-to-consider') ?? /* default= */ 2;

        const events = await db.selectFrom(tEvents)
            .selectOneColumn(tEvents.eventId)
            .where(tEvents.eventStartTime.lessThan(event.temporalStartTime))
            .orderBy(tEvents.eventStartTime, 'desc')
            .limit(numHistoricEventsToConsider)
            .executeSelectMany();

        const retentionJoin = tRetention.forUseInLeftJoin();
        const teamsJoin = tTeams.forUseInLeftJoin();
        const usersEventsJoin = tUsersEvents.forUseInLeftJoinAs('curEvent');
        const usersJoin = tUsers.forUseInLeftJoinAs('assignedUser');

        const dbInstance = db;
        const volunteers = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.eventId.equals(event.eventId))
                .and(usersEventsJoin.userId.equals(tUsersEvents.userId))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
            .leftJoin(retentionJoin)
                .on(retentionJoin.userId.equals(tUsersEvents.userId))
                .and(retentionJoin.eventId.equals(event.eventId))
                .and(retentionJoin.teamId.equals(tUsersEvents.teamId))
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(retentionJoin.retentionAssigneeId))
            .where(tUsersEvents.eventId.in(events))
                .and(tUsersEvents.teamId.equals(teamId))
                .and(tUsersEvents.registrationStatus.in(
                    [ RegistrationStatus.Accepted, RegistrationStatus.Cancelled ]))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                events: dbInstance.aggregateAsArray({
                    slug: tEvents.eventSlug,
                    name: tEvents.eventShortName,
                }),
                registrationStatus: dbInstance.aggregateAsArray({
                    status: usersEventsJoin.registrationStatus,
                    team: teamsJoin.teamSlug,
                }),
                retentionStatus: retentionJoin.retentionStatus,
                retentionAssigneeName: usersJoin.name,
                retentionNotes: retentionJoin.retentionNotes,
            })
            .groupBy(tUsersEvents.userId, usersEventsJoin.eventId)
            .executeSelectPage();

        const volunteerRows: RetentionRowModel[] = [];
        for (const volunteer of volunteers.data) {
            if (!volunteer.events.length)
                throw new Error('yo');

            const latestEvent = volunteer.events.pop()!;

            let status: RetentionRowModel['status'] = 'Unknown';
            let statusTeam: string | undefined;

            if (volunteer.registrationStatus.length) {
                for (const application of volunteer.registrationStatus) {
                    switch (application.status) {
                        case RegistrationStatus.Accepted:
                        case RegistrationStatus.Cancelled:
                            status = 'Retained';
                            statusTeam = application.team;
                            break;

                        case RegistrationStatus.Registered:
                            if (status !== 'Retained') {
                                status = 'Applied';
                                statusTeam = application.team;
                            }
                            break;
                    }
                }
            } else if (!!volunteer.retentionStatus) {
                status = volunteer.retentionStatus;
            }

            volunteerRows.push({
                id: volunteer.id,
                name: volunteer.name,
                latestEvent: latestEvent.name,
                latestEventSlug: latestEvent.slug,
                status, statusTeam,
                assigneeName: volunteer.retentionAssigneeName,
                notes: volunteer.retentionNotes,
            });
        }

        volunteerRows.sort((lhs, rhs) => {
            if (lhs.status !== rhs.status)
                return kRetentionSortOrder[lhs.status] - kRetentionSortOrder[rhs.status];

            return lhs.name.localeCompare(rhs.name);
        });

        return {
            success: true,
            rowCount: volunteers.count,
            rows: volunteerRows,
        }
    },

    async update({ context, row }) {
        const eventAndTeamId = await getEventAndTeamId(context);
        if (!eventAndTeamId)
            notFound();

        const { event, teamId } = eventAndTeamId;

        let retentionAssigneeId: number | null = null;
        if (!!row.assigneeName) {
            retentionAssigneeId = await db.selectFrom(tUsers)
                .selectOneColumn(tUsers.userId)
                .where(tUsers.name.equals(row.assigneeName))
                .executeSelectNoneOrOne();
        }

        let status: any = null;
        if (row.status === 'Unknown' && !!retentionAssigneeId)
            status = 'Contacting';
        else if (row.status !== 'Unknown' && !!retentionAssigneeId)
            status = row.status;

        const affectedRows = await db.insertInto(tRetention)
            .set({
                userId: row.id,
                eventId: event.eventId,
                teamId: teamId,
                retentionStatus: status,
                retentionAssigneeId,
                retentionNotes: row.notes,
            })
            .onConflictDoUpdateSet({
                retentionStatus: status,
                retentionAssigneeId,
                retentionNotes: row.notes,
            })
            .executeInsert();

        return { success: !!affectedRows }
    },

    async writeLog({ id, context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        if (!event || mutation !== 'Updated')
            return;

        await Log({
            type: LogType.AdminEventRetentionUpdate,
            severity: LogSeverity.Info,
            sourceUser: props.user,
            targetUser: /* rowId = userId = */ id,
            data: {
                event: event.shortName,
            }
        });
    },
});
