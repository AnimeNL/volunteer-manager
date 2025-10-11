// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback } from 'react';

import type { GridCellParams, ValueOptions } from '@mui/x-data-grid-pro';
import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import ErrorIcon from '@mui/icons-material/Error';
import IconButton from '@mui/material/IconButton';
import LaunchIcon from '@mui/icons-material/Launch';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { ProgramActivitiesRowModel } from '@app/api/admin/program/activities/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

import { kActivityType } from '@lib/database/Types';

/**
 * Props accepted by the <ActivityDataTable> component.
 */
interface ActivityDataTableProps {
    /**
     * Unique slug of the event for which activities should be shown.
     */
    event: string;

    /**
     * The locations that can be assigned to internal activities.
     */
    locations: ValueOptions[];
}

/**
 * The <ActivityDataTable> component displays a remote data table containing all the activities that
 * are known to the program of a particular festival. It links through to a separate page for each
 * activity displaying more information and timeslots. Activities can be created as well.
 */
export function ActivityDataTable(props: ActivityDataTableProps) {
    const context = { event: props.event };
    const columns: RemoteDataTableColumn<ProgramActivitiesRowModel>[] = [
        {
            field: 'id',
            headerName: '',
            align: 'center',
            editable: false,
            sortable: false,
            width: 50,

            // Only internal entries can be removed, AnPlan data is considered read-only.
            isProtected: params => params.row.type !== kActivityType.Internal,
        },
        {
            field: 'anplanLink',
            display: 'flex',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            editable: false,
            sortable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Open the activity in AnPlan">
                    <LaunchIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (!params.value) {
                    return (
                        <Tooltip title="This activity does not exist in AnPlan">
                            <LaunchIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="Open this activity in AnPlan">
                            <IconButton component={Link} href={params.value}
                                        target="_blank">
                                <LaunchIcon color="info" fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    );
                }
            },
        },
        {
            field: 'title',
            headerName: 'Activity',
            editable: true,
            sortable: true,
            flex: 2,

            renderCell: params => {
                if (params.row.type === kActivityType.Internal)
                    return params.value;

                return (
                    <MuiLink component={Link} href={`./activities/${params.row.id}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'locationId',
            display: 'flex',
            headerName: 'Location',
            editable: true,
            sortable: false,
            flex: 1,

            renderCell: params => {
                if (!!params.row.locationId) {
                    return (
                        <>
                            <MuiLink component={Link} href="./locations">
                                {params.row.location}
                            </MuiLink>
                            { params.row.timeslots > 1 &&
                                <Typography variant="body2" sx={{ pl: .5, color: 'text.disabled' }}>
                                    ({params.row.timeslots}x)
                                </Typography> }
                        </>
                    );
                } else if (params.row.location === 'No locations…') {
                    if (params.row.type === kActivityType.Internal) {
                        return (
                            <Tooltip title="Internal activities must have a location">
                                <ErrorIcon color="error" fontSize="small" />
                            </Tooltip>
                        );
                    }

                    return (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                            {params.row.location}
                        </Typography>
                    );
                } else {
                    return (
                        <>
                            {params.row.location}
                            { params.row.timeslots > 1 &&
                                <Typography variant="body2" sx={{ pl: .5, color: 'text.disabled' }}>
                                    ({params.row.timeslots}x)
                                </Typography> }
                        </>
                    );
                }
            },

            type: 'singleSelect',
            valueOptions: props.locations,

            valueSetter: (value, row) => {
                let locationName: string = 'No locations…';
                for (const location of props.locations) {
                    if (typeof location !== 'object' || !('value' in location))
                        continue;  // non-object ValueOption

                    if (location.value !== value)
                        continue;  // unrelated ValueOption

                    locationName = location.label;
                    break;
                }

                return {
                    ...row,
                    locationId: value,
                    location: locationName,
                };
            },
        },
        {
            field: 'helpRequested',
            display: 'flex',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            editable: false,
            sortable: true,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Has help been requested?">
                    <NewReleasesIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (params.row.shiftScheduled) {
                    return (
                        <Tooltip title="Shifts have been scheduled">
                            <NewReleasesIcon color="success" fontSize="small" />
                        </Tooltip>
                    );
                } else if (params.row.helpRequested) {
                    return (
                        <Tooltip title="Help has been requested">
                            <NewReleasesIcon color="error" fontSize="small" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="No help has been requested">
                            <MoreHorizIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                }
            },
        },
        {
            field: 'visible',
            display: 'flex',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            editable: false,
            sortable: true,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Has the activity been published?">
                    <VisibilityIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (!!params.value) {
                    return (
                        <Tooltip title="This activity has been announced">
                            <VisibilityIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="This activity should be kept private">
                            <VisibilityOffIcon color="warning" fontSize="small" />
                        </Tooltip>
                    );
                }
            },
        }
    ];

    // Only the title and location of Internal activities can be adjusted, everything else is frozen
    // as the values are imported from AnPlan, an external system. Determine this dynamically:
    const isCellEditable =
        useCallback((params: GridCellParams<ProgramActivitiesRowModel, unknown>) => {
            if (![ 'title', 'locationId' ].includes(params.colDef.field))
                return false;  // invalid column

            if (params.row.type !== kActivityType.Internal)
                return false;  // AnPlan-sourced activity

            return true;

        }, [ /* no dependencies */ ]);

    return (
        <Box sx={{ p: 2 }}>
            <RemoteDataTable columns={columns} endpoint="/api/admin/program/activities"
                             context={context} pageSize={10} enableCreate enableDelete
                             enableUpdate enableQueryParams={true}
                             defaultSort={{ field: 'title', sort: 'asc' }}
                             isCellEditable={isCellEditable} subject="activity" />
        </Box>
    );
}
