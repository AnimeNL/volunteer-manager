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
import { StatusCell } from './StatusCell';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { getContextForVolunteerAction } from './VolunteerActions';
import { isBefore, type ZonedDateTime } from '@lib/Temporal';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tRoles, tUsersEvents, tUsers, tUsersCommunication, tSchedule, tShifts, tShiftsCategories, tEvents } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';
import { kCommunicationLanguage, kRegistrationStatus } from '@lib/database/Types';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';

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
 * Data source used to populate the volunteer list for a particular event and team tuple.
 */
const volunteerDataSource = createDataSource('event/team/volunteers', withContext({
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
     * Status of their application across the different types of information they have to provide.
     */
    status: z.object({
        hotelEligible: z.number(),
        trainingEligible: z.number(),
    }),

    /**
     * Most recent time a communication of a given type was sent, in a Temporal ZonedDateTime
     * compatible serialization.
     */
    communication: z.record(z.string(), z.string()),

    /**
     * Number of unique events the volunteer has participated in prior to the current event.
     */
    priorParticipationCount: z.number(),

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

        const currentEventStartTime = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventId.equals(context.eventId))
            .selectOneColumn(tEvents.eventStartTime)
            .executeSelectOne();

        const priorEvent = tEvents.as('priorEvent');
        const priorRegistration = tUsersEvents.as('priorRegistration');

        const priorEventsSubSelect = dbInstance.subSelectUsing(tUsersEvents)
            .from(priorRegistration)
            .innerJoin(priorEvent)
                .on(priorEvent.eventId.equals(priorRegistration.eventId))
            .where(priorRegistration.userId.equals(tUsersEvents.userId))
                .and(priorEvent.eventStartTime.lessThan(currentEventStartTime))
                .and(priorRegistration.registrationStatus.equals(kRegistrationStatus.Accepted))
            .selectOneColumn(dbInstance.count(priorRegistration.eventId))
            .forUseAsInlineQueryValue();

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
                priorParticipationCount: priorEventsSubSelect.valueWhenNull(0),
                shiftSeconds: shiftSecondsSubSelect,
                status: {
                    hotelEligible:
                        tUsersEvents.hotelEligible.valueWhenNull(tRoles.roleHotelEligible),
                    trainingEligible:
                        tUsersEvents.trainingEligible.valueWhenNull(tRoles.roleTrainingEligible),
                },
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
