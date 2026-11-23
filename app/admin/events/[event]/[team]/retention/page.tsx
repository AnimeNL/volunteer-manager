// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import RepeatIcon from '@mui/icons-material/Repeat';

import type { Column } from '@app/admin/components/DataTable';
import type { RetentionCellContext } from './RetentionCells';
import type { RetentionRowModel } from './RetentionDataSource';
import { DataTable } from '@app/admin/components/DataTable';
import { RetentionActionsCell, RetentionLatestEventCell, RetentionStatusCell,
    RetentionStatusMobileCell, RetentionVolunteerCell } from './RetentionCells';
import { RetentionOutreachList } from './RetentionOutreachList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import { retentionDataSource } from './RetentionDataSource';
import db, { tRetention, tUsers, tUsersEvents } from '@lib/database';

import { kRetentionStatus } from '@lib/database/Types';

import { sendRetentionEmail } from './RetentionActions';

/**
 * The retention page displays a recruiting tool to understand how participants from the past two
 * events are interested in participating in the upcoming event.
 */
export default async function EventTeamRetentionPage(
    props: PageProps<'/admin/events/[event]/[team]/retention'>)
{
    const { access, event, team, user } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.retention',
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

    const canUpdateRetention = access.can('volunteers.retention', 'update', {
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
                     documentation="event/retention" limited={!canUpdateRetention}
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
