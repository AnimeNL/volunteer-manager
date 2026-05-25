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

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import type { CommunicationCellContext } from './CommunicationCell';
import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { CommunicationCell, CommunicationHeaderCell } from './CommunicationCell';
import { DataTable, createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { ExperienceCell, ExperienceHeaderCell } from './ExperienceCell';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftsCell } from './ShiftsCell';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { isBefore, type ZonedDateTime } from '@lib/Temporal';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tRoles, tUsersEvents, tUsers, tUsersCommunication, tSchedule, tShifts, tShiftsCategories } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';
import { kCommunicationLanguage, kRegistrationStatus } from '@lib/database/Types';

/**
 * Server Action that will be invoked by the <CommunicationButton> component when a communication
 * should be send on the user's behalf. All input should be treated as untrusted until verified.
 */
async function sendCommunication(
    eventId: number, teamId: number, userId: number, promptId: CommunicationPromptId,
    subject?: string, message?: string)
{
    'use server';

    // TODO: Implement this.

    return {
        success: true,
        message: 'Not yet implemented?!',
    };
}

/**
 * Data source used to populate the volunteer list for a particular event and team tuple.
 */
const volunteerDataSource = createDataSource('event/volunteers', withContext({
    /**
     * Unique ID of the event to display volunteers for.
     */
    eventId: z.number(),

    /**
     * Unique ID of the team to display volunteers for.
     */
    teamId: z.number(),

}), withRowModel({
    /**
     * Unique ID of the volunteer, as they exist in the database.
     */
    id: z.number(),

    /**
     * Name of the volunteer, preferring their display name over their actual one.
     */
    name: z.string(),

    /**
     * First name of the volunteer, unless they have a display name set.
     */
    firstName: z.string(),

    /**
     * When known, the language in which the volunteer would like to be communicated with in.
     */
    language: z.enum(kCommunicationLanguage).optional(),

    /**
     * Role the volunteer has been assigned in this event.
     */
    role: z.string(),

    /**
     * Order in which the row should be displayed. Used for the default sorting order.
     */
    roleOrder: z.number(),

    /**
     * Whether the role comes with a permission grant, which we presume means Senior+.
     */
    roleHasPermissionGrant: z.boolean(),

    /**
     * Total number of seconds a volunteer has been scheduled on shifts whose contribution should
     * count.
     */
    shiftSeconds: z.number().optional(),

    /**
     * Most recent time a communication of a given type was sent, in a Temporal ZonedDateTime
     * compatible serialization.
     */
    communication: z.record(z.string(), z.string()),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.volunteers.information',
                operation: 'read',
                scope: {
                    event: kAnyEvent,
                    team: kAnyTeam,
                },
            },
        });
    },

    async list(params, props, context) {
        const dbInstance = db;
        const usersCommunicationJoin = tUsersCommunication.forUseInLeftJoin();

        const shiftSecondsFragment = dbInstance.fragmentWithType('int', 'optional').sql`
            TIMESTAMPDIFF(SECOND, ${tSchedule.scheduleTimeStart}, ${tSchedule.scheduleTimeEnd})`;

        const shiftSecondsSubSelect = dbInstance.subSelectUsing(tUsersEvents)
            .from(tSchedule)
            .innerJoin(tShifts)
                .on(tShifts.shiftId.equals(tSchedule.shiftId))
            .innerJoin(tShiftsCategories)
                .on(tShiftsCategories.shiftCategoryId.equals(tShifts.shiftCategoryId))
            .where(tSchedule.userId.equals(tUsersEvents.userId))
                .and(tSchedule.eventId.equals(tUsersEvents.eventId))
                .and(tSchedule.scheduleDeleted.isNull())
                .and(tShiftsCategories.shiftCategoryCountContribution.equals(/* true= */ 1))
            .selectOneColumn(dbInstance.sum(shiftSecondsFragment).valueWhenNull(0))
            .forUseAsInlineQueryValue();

        const volunteers = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .leftJoin(usersCommunicationJoin)
                .on(usersCommunicationJoin.userId.equals(tUsersEvents.userId))
                    .and(usersCommunicationJoin.communicationEventId.equals(tUsersEvents.eventId))
                    .and(usersCommunicationJoin.communicationTeamId.equals(tUsersEvents.teamId))
            .groupBy(tUsersEvents.userId)
            .where(tUsersEvents.eventId.equals(context.eventId))
                .and(tUsersEvents.teamId.equals(context.teamId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(tUsers.name.containsIfValue(params.search).or(
                    tRoles.roleName.containsIfValue(params.search)))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                language: tUsers.language,
                role: tRoles.roleName,
                roleOrder: tRoles.roleOrder,
                roleHasPermissionGrant: tRoles.rolePermissionGrant.isNotNull(),
                shiftSeconds: shiftSecondsSubSelect,
                communication: dbInstance.aggregateAsArray({
                    promptId: usersCommunicationJoin.communicationPromptId,
                    date: usersCommunicationJoin.communicationDate,
                }),
            })
            .orderBy(params.sort.field as any, params.sort.direction)
                .orderBy('name', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        const rows = volunteers.data.map(volunteer => {
            const communication: Record<string, string> = {};
            const communicationPrompts: Map<string, ZonedDateTime> = new Map();
            for (const item of volunteer.communication) {
                const latestCommunication = communicationPrompts.get(item.promptId);
                if (!latestCommunication || isBefore(latestCommunication, item.date))
                    communicationPrompts.set(item.promptId, item.date);
            }

            for (const [ promptId, date ] of communicationPrompts.entries())
                communication[promptId] = date.toString();

            return {
                ...volunteer,
                communication,
            };
        });

        return {
            rowCount: volunteers.count,
            rows,
        };
    },

});

/**
 * Export the row model for use in the child components used by the data table.
 */
export type VolunteerRowModel = ExtractRowModel<typeof volunteerDataSource>;

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

            template: 'linkedText',
            templateProps: {
                href: './volunteers/{id}',
            },
        },
        {
            field: 'roleOrder',
            headerName: 'Role',
            flex: 1,

            template: 'otherFieldText',
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
        // TODO: Status
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
                    action: sendCommunication.bind(null, event.id, team.id),
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

    return (
        <>
            <Section headerAction={headerAction} title={`${event.shortName} ${team.name}`}>
                <DataTable columns={columns} source={volunteerDataSource} search="prominent"
                           context={{ eventId: event.id, teamId: team.id }} disableFooter
                           defaultSort={{ field: 'roleOrder', sort: 'asc' }} pageSize={100}
                           listViewProps={{
                               primaryField: 'name',
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
