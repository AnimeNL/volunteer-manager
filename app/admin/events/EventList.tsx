// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { Chip } from '@app/admin/components/Chip';
import { DataTable, type DataTableColumn } from '@app/admin/components/DataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Icon to show for events that are currently active.
 */
const kEventActiveIcon = (
    <Tooltip title="This event is currently active">
        <VisibilityIcon color="success" fontSize="small" />
    </Tooltip>
);

/**
 * Icon to show for teams that are currently suspended.
 */
const kEventSuspendedIcon = (
    <Tooltip title="This event has been suspended">
        <VisibilityOffIcon color="disabled" fontSize="small" />
    </Tooltip>
);

/**
 * Information for an individual event that should be listed on this page. Access checks should
 * already have been done, as we'd be leaking data if it ends up on the client anyway.
 */
export interface EventListEntry {
    /**
     * Unique ID of the event as it exists in the database.
     */
    id: number;

    /**
     * Whether the event has been hidden, i.e. no longer visible with access revoked.
     */
    hidden: boolean;

    /**
     * Short name of the event as volunteers can recognise it.
     */
    shortName: string;

    /**
     * Slug of the event, through which it is identified in URLs.
     */
    slug: string;

    /**
     * Date and time at which the event will commence. Represented in Temporal `ZonedDateTime`-
     * compatible format in UTC.
     */
    startTime: string;

    /**
     * Date and time at which the event will finish. Represented in Temporal `ZonedDateTime`-
     * compatible format in UTC.
     */
    endTime: string;

    /**
     * Names of the teams that have participated in this event.
     */
    teams: {
        /**
         * Name of this team, human readable.
         */
        name: string;

        /**
         * Color in which this team should be highlighted.
         */
        themeColor: string;
    }[];
}

/**
 * Props accepted by the <EventList> component.
 */
interface EventListProps {
    /**
     * The events that should be displayed on this page. There should be at least one.
     */
    events: EventListEntry[];
}

/**
 * The <EventList> component displays a list of the events that exist within the AnimeCon Volunteer
 * Manager. While the exact selection depends on the access granted to the signed in user, in many
 * cases it will be more complete than the menu drop-down list.
 */
export function EventList(props: EventListProps) {
    const columns: DataTableColumn<EventListEntry>[] = [
        {
            field: 'hidden',
            display: 'flex',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 75,

            renderCell: params =>
                params.value ? kEventSuspendedIcon : kEventActiveIcon,
        },
        {
            field: 'shortName',
            headerName: 'Name',
            sortable: true,
            flex: 2,

            renderCell: params =>
                <MuiLink component={Link} href={`/admin/events/${params.row.slug}`}>
                    {params.value}
                </MuiLink>
        },
        {
            field: 'startTime',
            headerName: 'Begin',
            sortable: true,
            flex: 1,

            renderCell: params =>
                formatDate(Temporal.ZonedDateTime.from(params.value), 'YYYY-MM-DD'),
        },
        {
            field: 'endTime',
            headerName: 'End',
            sortable: true,
            flex: 1,

            renderCell: params =>
                formatDate(Temporal.ZonedDateTime.from(params.value), 'YYYY-MM-DD'),
        },
        {
            field: 'teams',
            display: 'flex',
            headerName: 'Teams',
            sortable: false,
            flex: 2,

            renderCell: params => {
                if (!params.value.length)
                    return undefined;

                const teams = [ ...params.value ] as EventListEntry['teams'];
                teams.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

                return (
                    <Stack direction="row" spacing={1}>
                        { teams.map((team, index) =>
                            <Chip key={index} color={team.themeColor} label={team.name} /> ) }
                    </Stack>
                );
            },
        }
    ];

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                AnimeCon Events
            </Typography>
            <DataTable columns={columns} rows={props.events}
                       defaultSort={{ field: 'startTime', sort: 'desc' }} disableFooter />
        </Paper>
    );
}
