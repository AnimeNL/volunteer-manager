// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LaunchIcon from '@mui/icons-material/Launch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ProgramLocationsContext, ProgramLocationsRowModel } from '@app/api/admin/program/locations/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

import { kActivityType } from '@lib/database/Types';

/**
 * Props accepted by the <LocationDataTable> component.
 */
interface LocationDataTableProps {
    /**
     * Areas that exist during this festival, which locations can be located in.
     */
    areas: {
        /**
         * Unique ID of the area that can be selected.
         */
        value: number;

        /**
         * Label of the area as it should be presented to the user.
         */
        label: string;
    }[];

    /**
     * Context to be passed to the underlying `RemoteDataTable` interface.
     */
    context: ProgramLocationsContext['context'];
};

/**
 * The <LocationDataTable> component displays an editable data table containing the locations we use
 * during a given event, identified by the `festivalId`. Internal entries are fully editable,
 * whereas entries sourced from AnPlan are read-only except for the ability to set a custom name.
 */
export function LocationDataTable({ areas, context }: LocationDataTableProps) {
    const columns: RemoteDataTableColumn<ProgramLocationsRowModel>[] = [
        {
            field: 'id',
            headerName: '',
            editable: false,
            sortable: false,
            width: 50,

            // Only internal entries can be removed, AnPlan data is considered read-only.
            isProtected: params => params.row.type !== kActivityType.Internal,
        },
        {
            field: 'type',
            display: 'flex',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            editable: false,
            sortable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Open the location in AnPlan">
                    <LaunchIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (params.value === kActivityType.Internal || !params.row.anplanLink) {
                    return (
                        <Tooltip title="This location does not exist in AnPlan">
                            <LaunchIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="Open this location in AnPlan">
                            <IconButton component={Link} href={params.row.anplanLink}
                                        target="_blank">
                                <LaunchIcon color="info" fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    );
                }
            },
        },
        {
            field: 'name',
            headerName: 'Location name',
            editable: false,
            sortable: true,
            flex: 1,
        },
        {
            field: 'displayName',
            headerName: 'Display name',
            editable: true,
            sortable: true,
            flex: 1,

            renderCell: params => {
                if (!!params.value)
                    return params.value;

                return (
                    <Typography component="span" variant="body2"
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        {params.row.name}
                    </Typography>
                );
            },
        },
        {
            field: 'area',
            headerName: 'Area',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: areas,

            renderCell: params =>
                <MuiLink component={Link} href="./areas">
                    {params.formattedValue ?? params.value}
                </MuiLink>,
        },
    ];

    return (
        <Box sx={{ p: 2 }}>
            <RemoteDataTable endpoint="/api/admin/program/locations" context={context}
                             columns={columns} defaultSort={{ field: 'name', sort: 'asc' }}
                             disableFooter enableCreate enableDelete enableUpdate refreshOnUpdate
                             pageSize={100} subject="location" />
        </Box>
    );
}
