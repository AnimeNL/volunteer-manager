// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import RepeatIcon from '@mui/icons-material/Repeat';

import type { Column } from '@app/admin/components/DataTable';
import type { RetentionCellContext } from './RetentionCells';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { RetentionActionsCell, RetentionLatestEventCell, RetentionStatusCell,
    RetentionStatusMobileCell, RetentionVolunteerCell } from './RetentionCells';
import { RetentionOutreachList } from './RetentionOutreachList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tEvents, tRetention, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kCommunicationLanguage, kRegistrationStatus, kRetentionStatus, type RetentionStatus }
    from '@lib/database/Types';
import { kEventTransformer, kTeamTransformer } from '@app/admin/components/DataTable';

import { sendRetentionEmail } from './RetentionActions';

/**
 * Row model for the retention data table.
 */
const kRetentionRowModel = withRowModel({
    /**
     * Unique ID assigned to this person in the retention table.
     */
    id: z.number(),

    /**
     * Unique ID of the user in the database for account linking.
     */
    userIdForAccountLink: z.number().optional(),

    /**
     * Name of the volunteer for whom retention is being considered.
     */
    name: z.string(),

    /**
     * The volunteer's first name.
     */
    firstName: z.string(),

    /**
     * Language in which the communication should be written, when known.
     */
    language: z.enum(kCommunicationLanguage).optional(),

    /**
     * The most recent event that this volunteer participated in.
     */
    latestEvent: z.string(),

    /**
     * Slug of the most recent event that the volunteer participated in.
     */
    latestEventSlug: z.string(),

    /**
     * Whether their participation in the most recent event was cancelled.
     */
    latestEventDidCancel: z.boolean(),

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
    assigneeName: z.string().nullish(),

    /**
     * Notes that were written by that lead regarding contacting this person.
     */
    notes: z.string().nullish(),
});

/**
 * Type of a retention row model.
 */
export type RetentionRowModel = z.infer<typeof kRetentionRowModel>;

/**
 * The table will first be sorted by status, and this record decides the actual order.
 */
const kRetentionSortOrder: Record<RetentionRowModel['status'], number> = {
    'Unknown': 0,
    'Contacting': 2,
    'Applied': 3,
    'Retained': 4,
    'Declined': 5,
};

/**
 * Data source for the retention table.
 */
const retentionDataSource = createDataSource('admin/event/retention', withContext({
    /**
     * Event for which retention is being managed.
     */
    event: kEventTransformer,

    /**
     * Team for which retention is being managed.
     */
    team: kTeamTransformer,

}), kRetentionRowModel, {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.retention',
            operation,
            scope: {
                event: context.event.slug,
                team: context.team.slug,
            },
        });
    },

    async list(params, props, context) {
        const numHistoricEventsToConsider =
            await readSetting('retention-number-of-events-to-consider') ?? /* default= */ 2;

        const events = await db.selectFrom(tEvents)
            .selectOneColumn(tEvents.eventId)
            .where(tEvents.eventStartTime.lessThan(context.event.startTime))
            .orderBy(tEvents.eventStartTime, 'desc')
            .limit(numHistoricEventsToConsider)
            .executeSelectMany();

        if (!events.length) {
            return {
                rowCount: 0,
                rows: [],
            };
        }

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
                .on(usersEventsJoin.eventId.equals(context.event.id))
                .and(usersEventsJoin.userId.equals(tUsersEvents.userId))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
            .leftJoin(retentionJoin)
                .on(retentionJoin.userId.equals(tUsersEvents.userId))
                .and(retentionJoin.eventId.equals(context.event.id))
                .and(retentionJoin.teamId.equals(tUsersEvents.teamId))
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(retentionJoin.retentionAssigneeId))
            .where(tUsersEvents.eventId.in(events))
                .and(tUsersEvents.teamId.equals(context.team.id))
                .and(tUsersEvents.registrationStatus.in(
                    [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                language: tUsers.language,
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
                continue;

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
                language: volunteer.language,
                latestEvent: latestEvent.name,
                latestEventSlug: latestEvent.slug,
                latestEventDidCancel: latestEvent.status === kRegistrationStatus.Cancelled,
                status,
                statusTeam,
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
            rowCount: volunteers.count,
            rows: volunteerRows,
        };
    },

    async update(updatedRow, previousRow, props, context) {
        let updatedAssigneeId: number | undefined | null;
        if (!!updatedRow.assigneeName) {
            updatedAssigneeId = await db.selectFrom(tUsers)
                .selectOneColumn(tUsers.userId)
                .where(tUsers.name.equals(updatedRow.assigneeName))
                .executeSelectNoneOrOne();
        }

        let retentionStatus: RetentionStatus | undefined | null;
        let retentionAssigneeId: number | undefined | null;

        switch (updatedRow.status) {
            case 'Contacting':
            case 'Declined':
                retentionStatus = updatedRow.status;
                retentionAssigneeId = updatedAssigneeId || props.user.id;
                break;

            case 'Unknown':
                if (updatedRow.assigneeName !== previousRow.assigneeName && !!updatedAssigneeId) {
                    retentionStatus = 'Contacting';
                    retentionAssigneeId = updatedAssigneeId;
                } else {
                    retentionStatus = undefined;
                    retentionAssigneeId = undefined;
                }
                break;

            case 'Applied':
            case 'Retained':
                break;
        }

        const affectedRows = await db.insertInto(tRetention)
            .set({
                userId: updatedRow.id,
                eventId: context.event.id,
                teamId: context.team.id,
                retentionStatus,
                retentionAssigneeId,
                retentionNotes: updatedRow.notes,
            })
            .onConflictDoUpdateSet({
                retentionStatus,
                retentionAssigneeId,
                retentionNotes: updatedRow.notes,
            })
            .executeInsert();

        LogBuilder.for('UpdateRetention')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(updatedRow.id)
            .record({
                event: context.event.shortName,
            });

        return !!affectedRows;
    },
});

/**
 * The retention page displays a recruiting tool to understand how participants from the past two
 * events are interested in participating in the upcoming event.
 */
export default async function EventTeamRetentionPage(
    props: PageProps<'/admin/events/[event]/[team]/retention'>)
{
    const { access, event, team, user } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.retention',
        operation: 'read',
    });

    const usersEventJoin = tUsersEvents.forUseInLeftJoin();

    const assignedVolunteers = await db.selectFrom(tRetention)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tRetention.userId))
        .leftJoin(usersEventJoin)
            .on(usersEventJoin.userId.equals(tRetention.userId))
            .and(usersEventJoin.eventId.equals(tRetention.eventId))
        .where(tRetention.eventId.equals(event.id))
            .and(tRetention.teamId.equals(team.id))
            .and(tRetention.retentionStatus.notEquals(kRetentionStatus.Declined))
            .and(tRetention.retentionAssigneeId.equals(user.id))
            .and(usersEventJoin.registrationStatus.isNull())
        .select({
            id: tRetention.userId,
            name: tUsers.name,
            email: tUsers.username,
            phoneNumber: tUsers.phoneNumber,
        })
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    const comprehensiveLeaders = await getLeadersForEvent(event.id);
    const leaders = comprehensiveLeaders.map(leader => leader.label);

    const canUpdateRetention = access.can('event.retention', 'update', {
        event: event.slug,
        team: team.slug,
    });

    const whatsAppLink = `https://${team.domain}/registration`;
    const whatsAppMessage = await readSetting('retention-whatsapp-message') ?? '{name}, {link}?!';

    // ---------------------------------------------------------------------------------------------

    const cellContext: RetentionCellContext = {
        event: event.slug,
        eventId: event.id,
        eventName: event.shortName,
        leaders,
        sendEmailFn: sendRetentionEmail.bind(null, event.slug, team.slug),
        team: team.slug,
        teamId: team.id,
        whatsAppLink,
        whatsAppMessage,
    };

    const columns: Column<RetentionRowModel>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            editable: false,
            sortable: false,
            flex: 2,

            template: 'component',
            templateProps: {
                component: RetentionVolunteerCell,
                componentContext: cellContext,
            },
        },
        {
            field: 'latestEvent',
            headerName: 'Latest event',
            editable: false,
            sortable: false,
            flex: 2,

            template: 'component',
            templateProps: {
                component: RetentionLatestEventCell,
                componentContext: cellContext,
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            editable: canUpdateRetention,
            sortable: false,
            width: 115,

            type: 'singleSelect',
            valueOptions: [ 'Unknown', 'Contacting', 'Declined' ],

            template: 'component',
            templateProps: {
                component: RetentionStatusCell,
            },
        },
        {
            field: 'assigneeName',
            headerName: 'Assignee',
            editable: canUpdateRetention,
            sortable: false,
            flex: 2,

            type: 'singleSelect',
            valueOptions: [ ' ', ...leaders ],

            template: 'text',
            templateProps: {
                defaultValue: 'Unassigned',
            },
        },
        {
            field: 'firstName',
            headerName: 'Actions',
            editable: false,
            sortable: false,
            width: 80,

            template: 'component',
            templateProps: {
                component: RetentionActionsCell,
                componentContext: cellContext,
            },
        },
        {
            field: 'notes',
            headerName: 'Notes',
            editable: canUpdateRetention,
            sortable: false,
            flex: 3,

            template: 'text',
        },
    ];

    return (
        <>
            <Section icon={ <RepeatIcon color="primary" /> }
                     title={ `${team.title.replace(/s$/, '')} retention` }
                     documentation="event/retention"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Retention' },
                     ]}>
                <SectionIntroduction>
                    We aim to retain 60–75% of volunteers each year. These are people from previous
                    years whom you can contact through email or WhatsApp.
                </SectionIntroduction>
            </Section>
            <RetentionOutreachList assignedVolunteers={assignedVolunteers} />
            <Section noHeader>
                <DataTable columns={columns} source={retentionDataSource}
                           context={{ event: event.slug, team: team.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           pageSize={100} disableFooter refreshOnMutation
                           listViewProps={{
                               primaryField: 'name',
                               secondaryTemplate: '{status} · {latestEvent}',
                               startComponent: RetentionStatusMobileCell,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Retention', { team: 'team' }, { event: 'event' });
