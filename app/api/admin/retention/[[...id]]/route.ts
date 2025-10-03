// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeAction } from '@app/api/Action';
import { getEventBySlug } from '@lib/EventLoader';
import { readSetting } from '@lib/Settings';
import db, { tEvents, tRetention, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import { remindParticipation, kRemindParticipationDefinition } from '../remindParticipation';

/**
 * Row model for an individual piece of advice offered by Del a Rie Advies.
 */
const kRetentionRowModel = z.object({
    /**
     * Unique ID assigned to this person in the retention table.
     */
    id: z.number(),

    /**
     * Unique ID of the user in the database. Should only be populated when a link is to be shown to
     * their account page, separate from their previous participation.
     */
    userIdForAccountLink: z.number().optional(),

    /**
     * Name of the volunteer for whom retention is being considered.
     */
    name: z.string(),

    /**
     * The volunteer's first name. Won't be presented in UI, but will be used for messages.
     */
    firstName: z.string(),

    /**
     * The most recent event that this volunteer participated in.
     */
    latestEvent: z.string().optional(),

    /**
     * Slug of the most recent event that the volunteer participated in.
     */
    latestEventSlug: z.string().optional(),

    /**
     * Whether their participation in the most recent event was cancelled.
     */
    latestEventDidCancel: z.boolean().optional(),

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
                forbidden();

            case 'list':
            case 'update':
                executeAccessCheck(props.authenticationContext, {
                    check: 'admin-event',
                    event: context.event,

                    permission: {
                        permission: 'event.retention',
                        operation: action === 'list' ? 'read' : 'update',
                        scope: {
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
    async list({ context }, props) {
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
                    [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                events: dbInstance.aggregateAsArray({
                    slug: tEvents.eventSlug,
                    name: tEvents.eventShortName,
                    status: tUsersEvents.registrationStatus,
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

        const includeAccountLink = props.access.can('organisation.accounts', 'read');

        const volunteerRows: RetentionRowModel[] = [];
        for (const volunteer of volunteers.data) {
            if (!volunteer.events.length)
                throw new Error('yo');

            const latestEvent = volunteer.events.pop()!;

            let status: RetentionRowModel['status'] = 'Unknown';
            let statusTeam: string | undefined;
            let userIdForAccountLink: number | undefined;

            if (volunteer.registrationStatus.length) {
                for (const application of volunteer.registrationStatus) {
                    switch (application.status) {
                        case kRegistrationStatus.Accepted:
                        case kRegistrationStatus.Cancelled:
                            status = 'Retained';
                            statusTeam = application.team;
                            break;

                        case kRegistrationStatus.Registered:
                            if (status !== 'Retained') {
                                status = 'Applied';
                                statusTeam = application.team;
                            }
                            break;
                    }
                }
            } else if (!!volunteer.retentionStatus) {
                status = volunteer.retentionStatus;
            } else {
                if (includeAccountLink)
                    userIdForAccountLink = volunteer.id;
            }

            volunteerRows.push({
                id: volunteer.id,
                userIdForAccountLink,
                name: volunteer.name,
                firstName: volunteer.firstName,
                latestEvent: latestEvent.name,
                latestEventSlug: latestEvent.slug,
                latestEventDidCancel: latestEvent.status === kRegistrationStatus.Cancelled,
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

        RecordLog({
            type: kLogType.AdminEventRetentionUpdate,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            targetUser: /* rowId = userId = */ id,
            data: {
                event: event.shortName,
            }
        });
    },
});

/**
 * POST /api/admin/retention
 */
export async function POST(request: NextRequest): Promise<Response> {
    return executeAction(request, kRemindParticipationDefinition, remindParticipation);
}
