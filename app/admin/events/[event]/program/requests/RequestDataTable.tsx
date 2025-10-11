// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import AddTaskIcon from '@mui/icons-material/AddTask';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ProgramRequestContext, ProgramRequestRowModel } from '@app/api/admin/program/requests/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Square } from '@app/admin/components/Square';

/**
 * Information about a particular team shown on the request overview table.
 */
export interface TeamInfo {
    /**
     * Unique ID of the team, used for matching assigned shifts.
     */
    id: number;

    /**
     * Colour, as an HTML-valid colour code, the team identifies themselves with.
     */
    colour: string;

    /**
     * Name of the team, as they should be labelled.
     */
    name: string;

    /**
     * Unique slug that identifies this team in URLs.
     */
    slug: string;
}

/**
 * Props accepted by the <RequestDataTable> component.
 */
export type RequestDataTableProps = ProgramRequestContext & {
    /**
     * Leaders to whom a request can be assigned.
     */
    leaders: string[];

    /**
     * Whether the request data table should be considered read only, typically becauses the signed
     * in user doesn't have access to be an assignee.
     */
    readOnly?: boolean;

    /**
     * Teams that exist for the current event, and need to be considered for shift planning.
     */
    teams: TeamInfo[];
}

/**
 * The <RequestDataTable> component displays all received requests, together with their assignee and
 * shift status for each of the participating teams.
 */
export function RequestDataTable(props: RequestDataTableProps) {
    const columns: RemoteDataTableColumn<ProgramRequestRowModel>[] = [
        {
            field: 'activity',
            headerName: 'Activity',
            editable: false,
            sortable: false,
            flex: 3,

            renderCell: params => {
                const href = `/admin/events/${props.event}/program/activities/${params.row.id}`;
                return (
                    <MuiLink component={Link} href={href}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            editable: false,
            sortable: false,
            flex: 1,

            renderCell: params => {
                switch (params.value) {
                    case 'Contacted':
                        return (
                            <Tooltip title="Someone is coordinating with the event owner">
                                <Chip size="small" label="Contacted" color="warning" />
                            </Tooltip>
                        );

                    case 'Scheduled':
                        return (
                            <Tooltip title="Shifts for this activity has been scheduled">
                                <Chip size="small" label="Scheduled" color="success" />
                            </Tooltip>
                        );

                    case 'Unknown':
                    default:
                        return (
                            <Tooltip title="This request has not been picked up yet">
                                <Chip size="small" label="Unknown" color="error" />
                            </Tooltip>
                        );
                }
            },
        },
        {
            field: 'assignee',
            headerName: 'Assignee',
            editable: !props.readOnly,
            sortable: false,
            flex: 2,

            type: 'singleSelect',
            valueOptions: [ ' ', ...props.leaders ],

            renderCell: params => {
                if (!!params.value)
                    return params.value;

                return (
                    <Typography component="span" variant="body2"
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        Unassigned
                    </Typography>
                );
            }
        },
        {
            field: 'notes',
            headerName: 'Notes',
            editable: !props.readOnly,
            sortable: false,
            flex: 3,

            renderCell: params => {
                if (!!params.value)
                    return params.value;

                return (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        …
                    </Typography>
                );
            }
        }
    ];

    for (const team of props.teams) {
        columns.push({
            field: `id_${team.id}`,
            display: 'flex',
            headerAlign: 'center',
            editable: false,
            sortable: false,
            align: 'center',
            width: 50,

            renderHeader: () =>
                <Square colour={team.colour} title={team.name} />,

            renderCell: params => {
                if (!Object.hasOwn(params.row.shifts, team.id)) {
                    return (
                        <Tooltip title="No shifts have been scheduled">
                            <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                        </Tooltip>
                    );
                }

                const shifts = params.row.shifts[`${team.id}`];
                if (shifts.length === 1) {
                    const href =
                        `/admin/events/${props.event}/${team.slug}/shifts/${shifts[0]}`;

                    return (
                        <Tooltip title="One shift has been scheduled">
                            <MuiLink component={Link} href={href} sx={{ lineHeight: '0.5em' }}>
                                <TaskAltIcon fontSize="small" color="success" />
                            </MuiLink>
                        </Tooltip>
                    );
                } else {
                    // TODO: Properly handle the >1 case by showing a menu, and enabling the user to
                    // click through straight away to each of the shifts.
                    return (
                        <Tooltip title={`${shifts.length} shifts have been scheduled`}>
                            <AddTaskIcon fontSize="small" color="warning" />
                        </Tooltip>
                    );
                }
            },
        });
    }

    return (
        <Box sx={{ p: 2 }}>
            <RemoteDataTable columns={columns} endpoint="/api/admin/program/requests" enableUpdate
                             context={{ event: props.event }} refreshOnUpdate pageSize={100}
                             disableFooter defaultSort={{ field: 'id', sort: 'asc' }} />
        </Box>
    );
}
