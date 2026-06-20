// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PersonIcon from '@mui/icons-material/Person';
import ShareIcon from '@mui/icons-material/Share';
import Tooltip from '@mui/material/Tooltip';

import type { Column } from '@app/admin/components/DataTable';
import type { CommunicationCellContext } from './CommunicationCell';
import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { CommunicationCell, CommunicationHeaderCell } from './CommunicationCell';
import { DataTable } from '@app/admin/components/DataTable';
import { ExperienceCell, ExperienceHeaderCell } from './ExperienceCell';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftsCell } from './ShiftsCell';
import { StatusCell } from './StatusCell';
import { type VolunteerRowModel, volunteerDataSource } from './dataSource';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { getContextForVolunteerAction } from './VolunteerActions';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tUsersEvents, tUsers } from '@lib/database';

import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be send on the user's behalf. All input should be treated as untrusted until verified.
 */
async function sendCommunicationToVolunteer(
    eventId: number, teamId: number, recipientId: number, promptId: CommunicationPromptId,
    subject?: string, message?: string)
{
    'use server';

    return executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(recipientId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: event.slug,
            permission: {
                permission: 'event.volunteers.information',
                operation: 'update',
                scope: {
                    event: event.slug,
                    team: team.slug,
                },
            },
        });

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject,
            message,
            metadata: {
                eventId,
                teamId,
                promptId,
            },
        });

        return {
            success: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}

/**
 * The <EventVolunteersPage> page lists the volunteers who signed up to participate in the |event|
 * for the given |team|. Direct communication functionality is exposed through this page.
 */
export default async function EventVolunteersPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers'>)
{
    const { access, event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!access.can('event.volunteers.information', 'read', { event: event.slug, team: team.slug }))
        forbidden();

    let headerAction: React.ReactNode;
    if (access.can('organisation.exports')) {
        headerAction = (
            <Tooltip title="Export volunteer list">
                <IconButton LinkComponent={Link} href="/admin/organisation/exports/create">
                    <ShareIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        );
    }

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
                    teamId: team.id
                } satisfies CommunicationCellContext,
            },
        },
    ];

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

    const totalVolunteerCount = await dbInstance.selectFrom(tUsersEvents)
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .selectCountAll()
        .executeSelectOne();

    return (
        <>
            <Section headerAction={headerAction} title={`${event.shortName} ${team.name}`}
                     subtitle={`${totalVolunteerCount} people`}>
                <DataTable columns={columns} source={volunteerDataSource} search="prominent"
                           context={{ eventId: event.id, teamId: team.id }} disableFooter
                           defaultSort={{ field: 'roleOrder', sort: 'asc' }} pageSize={100}
                           listViewProps={{
                               primaryField: 'name',
                               startComponent: ExperienceCell,
                               endComponent: StatusCell,
                               linkTemplate: './volunteers/{id}',
                           }} />
            </Section>
            { cancelledVolunteers.length > 0 &&
                <Section title="No longer participating…">
                    <SectionIntroduction>
                        The following volunteers cancelled their participation and are no longer
                        expected to help out the {team.name}.
                    </SectionIntroduction>
                    <List disablePadding sx={{
                        mx: '-16px !important',
                        mt: '8px !important',
                        mb: '-8px !important'
                    }}>
                        { cancelledVolunteers.map(volunteer =>
                            <ListItemButton key={volunteer.id} LinkComponent={Link}
                                            href={`./volunteers/${volunteer.id}`}>
                                <ListItemIcon>
                                    <PersonIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={volunteer.name} />
                            </ListItemButton> ) }
                    </List>
                </Section> }
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Volunteers');
