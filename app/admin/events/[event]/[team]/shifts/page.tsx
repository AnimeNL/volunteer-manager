// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import Alert from '@mui/material/Alert';
import CategoryIcon from '@mui/icons-material/Category';
import IconButton from '@mui/material/IconButton';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import Tooltip from '@mui/material/Tooltip';

import { ColourHeader, ColourCell, DemandCell, ScheduledCell, DescriptionHeader, DescriptionCell,
    ExcitementHeader, ExcitementCell } from './ShiftCells';
import { DataTable, createDataSource, kEventTransformer, kTeamTransformer, withContext,
    withRowModel, type Column, type ExtractRowModel } from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftSettingsForm } from './ShiftSettingsForm';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getShiftMetadata } from './getShiftMetadata';
import { getShiftsForEvent } from '@app/admin/lib/getShiftsForEvent';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tSchedule, tShifts } from '@lib/database';

import { createShift } from './ShiftActions';

/**
 * Data source for retrieving and deleting shifts.
 */
const shiftsDataSource = createDataSource('event/team/shifts', withContext({
    /**
     * Event for which the shifts should be obtained.
     */
    event: kEventTransformer,

    /**
     * Team for which the shifts should be obtained.
     */
    team: kTeamTransformer,

}), withRowModel({
    /**
     * Unique ID of the shift, as it exists in the database.
     */
    id: z.number(),

    /**
     * Colour assigned to the shift. Will be reflected in the scheduling tool.
     */
    colour: z.string(),

    /**
     * Category that this shift is part of.
     */
    category: z.string(),

    /**
     * Name of the shift. May match the program entry.
     */
    name: z.string(),

    /**
     * Description of the shift. What will volunteers be doing?
     */
    description: z.string().optional(),

    /**
     * How many minutes of shifts would minimally be scheduled?
     */
    demandInMinutes: z.number().optional(),

    /**
     * How many minutes of shifts have actually been scheduled?
     */
    scheduledInMinutes: z.number().optional(),

    /**
     * What is the volunteer excitement level for this shift, i.e. their sentiment?
     */
    excitement: z.number(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.shifts',
            operation,
            scope: {
                event: context.event.slug,
                team: context.team.slug,
            },
        });
    },

    async list(params, props, context) {
        const query = params.search?.toLowerCase();

        const allShifts = await getShiftsForEvent(
            context.event.id, context.event.integrations?.anPlanFestivalId);

        // First filter the |allShifts| to the ones part of this team:
        const teamShifts = allShifts.filter(shift => shift.team.id === context.team.id);

        // Then filter the |filteredShifts| based on the search query given in the datatable, if any.
        const filteredShifts = teamShifts.filter(shift => {
            return !query ||
                   shift.name.toLowerCase().includes(query) ||
                   shift.category.toLowerCase().includes(query) ||
                   shift.activity?.name.toLowerCase().includes(query);
        });

        // Sort the |filteredTeams| for demand and scheduled values. Other sort keys will resolve
        // to the default sort, which is first by category, then by shift name.
        filteredShifts.sort((lhs, rhs) => {
            let mutation: number = 0;
            switch (params.sort.field) {
                case 'demandInMinutes':
                    mutation = (lhs.demandInMinutes ?? 0) - (rhs.demandInMinutes ?? 0);
                    break;
                case 'scheduledInMinutes':
                    mutation = (lhs.scheduledInMinutes ?? 0) - (rhs.scheduledInMinutes ?? 0);
                    break;
            }

            return params.sort.direction === 'asc' ? mutation : -mutation;
        });

        return {
            rowCount: filteredShifts.length,
            rows: filteredShifts,
        };
    },

    async delete(row, props, context) {
        const dbInstance = db;

        // Confirm that nobody has been scheduled on this shift, which makes it immutable:
        const scheduled = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.shiftId.equals(row.id))
                .and(tSchedule.scheduleDeleted.isNull())
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!scheduled)
            throw new Error('Cannot delete shifts that have been scheduled already!');

        const affectedRows = await dbInstance.update(tShifts)
            .set({
                shiftDeleted: dbInstance.currentZonedDateTime()
            })
            .where(tShifts.shiftId.equals(row.id))
                .and(tShifts.eventId.equals(context.event.id))
                .and(tShifts.shiftDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteShift')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                team: context.team.title,
                shift: row.name,
            })

        return !!affectedRows;
    }
});

/**
 * Page that lists an overview of all shifts that have been created for a particular event and team
 * combination, with the ability to immediately create new shifts if so desired.
 */
export default async function EventTeamShiftsPage(
    props: PageProps<'/admin/events/[event]/[team]/shifts'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.shifts',
        operation: 'read',
    });

    if (!team.flags.enableScheduling)
        notFound();

    let headerAction: React.ReactNode;
    if (access.can('event.shift-categories')) {
        headerAction = (
            <IconButton LinkComponent={Link} href="./shifts/categories" size="small">
                <Tooltip title="Shift categories">
                    <TooltipIconWrapper>
                        <CategoryIcon color="primary" fontSize="small" />
                    </TooltipIconWrapper>
                </Tooltip>
            </IconButton>
        );
    }

    const columns: Column<ExtractRowModel<typeof shiftsDataSource>>[] = [
        {
            field: 'colour',
            display: 'flex',
            headerAlign: 'center',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: ColourHeader,
                component: ColourCell,
            },
        },
        {
            field: 'category',
            headerName: 'Category',
            sortable: false,
            width: 175,
        },
        {
            field: 'name',
            headerName: 'Shift',
            sortable: true,
            flex: 3,

            template: 'text',
            templateProps: {
                href: './shifts/{id}',
            },
        },
        {
            field: 'demandInMinutes',
            headerName: 'Demand',
            sortable: false,
            width: 125,

            template: 'component',
            templateProps: {
                component: DemandCell,
            },
        },
        {
            field: 'scheduledInMinutes',
            headerName: 'Scheduled',
            sortable: true,
            width: 125,

            template: 'component',
            templateProps: {
                component: ScheduledCell,
            },
        },
        {
            field: 'description',
            display: 'flex',
            headerAlign: 'center',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: DescriptionHeader,
                component: DescriptionCell,
            },
        },
        {
            field: 'excitement',
            display: 'flex',
            headerAlign: 'center',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: ExcitementHeader,
                component: ExcitementCell,
            },
        },
    ];

    const { activities, categories, locations } =
        await getShiftMetadata(event.integrations?.anPlanFestivalId);

    const permissionScope = { event: event.slug, team: team.slug };

    const canCreateShifts = access.can('event.shifts', 'create', permissionScope);
    const canDeleteShifts = access.can('event.shifts', 'delete', permissionScope);
    const canUpdateShifts = access.can('event.shifts', 'update', permissionScope);

    const createShiftFn = createShift.bind(null, event.slug, team.slug);

    return (
        <>
            <Section icon={ <PendingActionsIcon color="primary" /> } title="Shifts"
                     headerAction={headerAction}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Shifts' },
                     ]}>
                <SectionIntroduction>
                    Shifts that our volunteers can be asked to perform during {event.shortName}.
                    Prefer associating shifts with program entries whenever possible.
                </SectionIntroduction>
            </Section>
            { (!canCreateShifts && !canUpdateShifts && !canDeleteShifts) &&
                <Alert severity="warning" variant="outlined">
                    Please ask your Staff member to add you to the scheduling team if you would like
                    to be able to make any changes.
                </Alert> }
            <Section noHeader>
                <DataTable columns={columns} source={shiftsDataSource}
                           context={{ event: event.slug, team: team.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }} subject="shift"
                           listViewProps={{
                               primaryField: 'name',
                               secondaryField: 'description',
                               startComponent: ColourCell,
                               linkTemplate: './shifts/{id}',
                           }} />
            </Section>
            { canCreateShifts &&
                <FormGridSection icon={ <AddBoxOutlinedIcon /> } title="Create a new shift"
                                 action={createShiftFn} permission="event.shifts">
                    <ShiftSettingsForm activities={activities} categories={categories}
                                       locations={locations} />
                </FormGridSection> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Shifts', { team: 'team' }, { event: 'event' });
