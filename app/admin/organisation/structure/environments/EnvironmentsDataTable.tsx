// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Stack from '@mui/material/Stack';

import type { EnvironmentPurpose } from '@lib/database/Types';
import { Chip } from '../../../components/Chip';
import { DataTable, type DataTableColumn } from '@app/admin/components/DataTable';

/**
 * Human-readable description of the purposes of different environments.
 */
const kPurposeDescription: { [key in EnvironmentPurpose]: string } = {
    LandingPage: 'Landing page',
    Placeholder: 'Placeholder',
};

/**
 * Props accepted by the <EnvironmentsDataTable> component.
 */
interface EnvironmentsDataTableProps {
    /**
     * Array containing all environments known to the Volunteer Manager.
     */
    environments: {
        /**
         * Unique ID of the environment as it exists in the database. Required by <DataTable>.
         */
        id: number;

        /**
         * Domain through which the environment can be reached.
         */
        domain: string;

        /**
         * Title of the environment, which will be presented to the visitor.
         */
        title: string;

        /**
         * Purpose of the environment, i.e. what happens when you visit this domain?
         */
        purpose: EnvironmentPurpose;

        /**
         * Which team(s) are served through this domain?
         */
        teams: {
            /**
             * Name through which the team can be identified.
             */
            name: string;

            /**
             * CSS color through which the team can be identified.
             */
            color: string;

        }[];

    }[];
}

/**
 * The <EnvironmentsDataTable> component displays
 */
export function EnvironmentsDataTable(props: EnvironmentsDataTableProps) {
    const columns: DataTableColumn<EnvironmentsDataTableProps['environments'][number]>[] = [
        {
            field: 'domain',
            headerName: 'Environment',
            sortable: true,
            flex: 1,

            renderCell: params =>
                <MuiLink component={Link}
                         href={`/admin/organisation/structure/environments/${params.value}`}>
                    {params.value}
                </MuiLink>,
        },
        {
            field: 'title',
            headerName: 'Title',
            sortable: true,
            flex: 1,
        },
        {
            field: 'purpose',
            headerName: 'Purpose',
            sortable: true,
            flex: 1,

            renderCell: params => kPurposeDescription[params.row.purpose],
        },
        {
            display: 'flex',
            field: 'teams',
            headerName: 'Teams',
            sortable: false,
            flex: 2,

            renderCell: params =>
                <Stack direction="row" spacing={1} sx={{ pt: 0.25 }}>
                    { params.row.teams.map((team, index) =>
                        <Chip key={index} color={team.color} label={team.name} /> )}
                </Stack>
        }
    ];

    return (
        <DataTable columns={columns} rows={props.environments} disableFooter
                   defaultSort={{ field: 'id', sort: 'asc' }} pageSize={25} />
    );
}
