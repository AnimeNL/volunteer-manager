// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotInterestedIcon from '@mui/icons-material/NotInterested';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ShareIcon from '@mui/icons-material/Share';
import Tooltip from '@mui/material/Tooltip';

import type { Column } from '@app/admin/components/DataTable';
import type { CommunicationCellContext } from './CommunicationCell';
import type { VolunteerRowModel } from './dataSource';
import { CommunicationCell, CommunicationHeaderCell } from './CommunicationCell';
import { DataTable } from '@app/admin/components/DataTable';
import { ExperienceCell, ExperienceHeaderCell } from './ExperienceCell';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftsCell } from './ShiftsCell';
import { StatusCell } from './StatusCell';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import { volunteerDataSource } from './dataSource';
import db, { tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

import { sendCommunicationToVolunteer } from './VolunteerActions';

/**
 * The <EventVolunteersPage> page lists the volunteers who signed up to participate in the |event|
 * for the given |team|. Direct communication functionality is exposed through this page.
 */
export default async function EventVolunteersPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'volunteers.participation',
        operation: 'read',
    });

    const columns: Column<VolunteerRowModel>[] = [
        {
            field: 'id',
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: ExperienceHeaderCell,
                component: ExperienceCell,
            },
        },
        {
            field: 'name',
            headerName: 'Name',
            flex: 1,

            template: 'text',
            templateProps: {
                href: './volunteers/{id}',
            },
        },
        {
            field: 'roleOrder',
            headerName: 'Role',
            flex: 1,

            template: 'text',
            templateProps: {
                field: 'role',
            },
        },
        {
            field: 'shiftSeconds',
            headerName: 'Shifts',
            sortable: true,
            flex: 1,

            template: 'component',
            templateProps: {
                component: ShiftsCell,
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: StatusCell,
            },
        },
        {
            field: 'roleHasPermissionGrant',  // unrelated
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: CommunicationHeaderCell,
                component: CommunicationCell,
                componentContext: {
                    action: sendCommunicationToVolunteer.bind(null, event.id, team.id),
                    eventId: event.id,
                    eventName: event.shortName,
                    teamId: team.id,
                } satisfies CommunicationCellContext,
            },
        },
    ];

    // ---------------------------------------------------------------------------------------------
    // Cancelled volunteers:
    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;
    const cancelledVolunteers = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Cancelled))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Total number of volunteers for use in the header:
    // ---------------------------------------------------------------------------------------------

    const totalVolunteerCount = await dbInstance.selectFrom(tUsersEvents)
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .selectCountAll()
        .executeSelectOne();

    // ---------------------------------------------------------------------------------------------

    let headerAction: React.ReactNode;
    if (access.can('organisation.exports')) {
        headerAction = (
            <Tooltip title="Export volunteer list">
                <IconButton LinkComponent={Link} href="/admin/organisation/exports/create"
                            size="small">
                    <ShareIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        );
    }

    return (
        <>
            <Section icon={ <PeopleAltOutlinedIcon color="primary" /> } title="Volunteers"
                     subtitle={`${totalVolunteerCount}`} headerAction={headerAction}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Volunteers' },
                     ]}>
                <SectionIntroduction>
                    List of individuals who together serve as {event.shortName}'s {team.name}.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={volunteerDataSource} search="prominent"
                           context={{ event: event.slug, team: team.slug }} disableFooter
                           defaultSort={{ field: 'roleOrder', sort: 'asc' }} pageSize={100}
                           listViewProps={{
                               primaryField: 'name',
                               startComponent: ExperienceCell,
                               endComponent: StatusCell,
                               linkTemplate: './volunteers/{id}',
                           }} />
            </Section>
            { cancelledVolunteers.length > 0 &&
                <Section icon={ <NotInterestedIcon /> } title="Cancellations">
                    <SectionIntroduction>
                        The following volunteers cancelled their participation and are no longer
                        expected to help us out.
                    </SectionIntroduction>
                    <Divider />
                    <List dense disablePadding sx={{ margin: '8px -16px -8px -16px !important' }}>
                        { cancelledVolunteers.map(volunteer =>
                            <ListItemButton key={volunteer.id} LinkComponent={Link}
                                            href={`./volunteers/${volunteer.id}`}>
                                <ListItemIcon>
                                    <PersonOffIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={volunteer.name} />
                            </ListItemButton> ) }
                    </List>
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Volunteers', { team: 'team' }, { event: 'event' });

