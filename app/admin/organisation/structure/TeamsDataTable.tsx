// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiChip } from '@mui/material/Chip';
import { default as MuiLink } from '@mui/material/Link';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Tooltip from '@mui/material/Tooltip';

import { Chip } from '../../components/Chip';
import { DataTable, type DataTableColumn } from '@app/admin/components/DataTable';

/**
 * Props accepted by the <TeamsDataTable> component.
 */
interface TeamsDataTableProps {
    /**
     * Array containing all teams known to the Volunteer Manager.
     */
    teams: {
        /**
         * Unique ID of the team as it exists in the database. Required by <DataTable>.
         */
        id: number;

        /**
         * URL-safe slug through which the team is identifiable through a URL.
         */
        slug: string;

        /**
         * Title of the team, as it should be presented in print.
         */
        title: string;

        /**
         * Name of the team, as it should be presented in brief.
         */
        name: string;

        /**
         * RGB colour that indicates this team. Will be used on their badge.
         */
        color: string;

        /**
         * Domain name through which this team's schedules are served. The team has been orphaned
         * when no domain name is given, which can happen when an environment was removed.
         */
        domain?: string;

        /**
         * Whether the team is enabled or not. Disabled teams will be presented at the bottom in
         * a visually distinguished manner.
         */
        enabled: boolean;
    }[];
}

/**
 * The <TeamsDataTable> component displays the teams that are known to the Volunteer Manager. This
 * interface is read-only, and teams cannot be created through this Data Table.
 */
export function TeamsDataTable(props: TeamsDataTableProps) {
    const columns: DataTableColumn<TeamsDataTableProps['teams'][number]>[] = [
        {
            display: 'flex',
            field: 'title',
            headerName: 'Team',
            sortable: true,
            flex: 1,

            renderCell: params => {
                const link = (
                    <MuiLink component={Link}
                             sx={{
                                 textDecoration: !!params.row.enabled ? undefined : 'line-through',
                                 pt: 0.25,
                             }}
                             href={`/admin/organisation/structure/${params.row.slug}`}>
                        {params.value}
                    </MuiLink>
                );

                if (!!params.row.enabled)
                    return link;

                return (
                    <>
                        <Tooltip title="This team has been disabled">
                            <RemoveCircleOutlineIcon color="error" fontSize="small"
                                                     sx={{ mr: 1 }} />
                        </Tooltip>
                        {link}
                    </>
                );
            },
        },
        {
            field: 'domain',
            headerName: 'Domain',
            sortable: true,
            flex: 1,

            renderCell: params => {
                if (!params.value) {
                    return <MuiChip color="error" size="small" label="no domain" />;
                }

                return (
                    <MuiLink component={Link} href={`https://${params.value}`} target="_blank">
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'name',
            headerName: 'Badge',
            sortable: false,
            flex: 1,

            renderCell: params =>
                <Chip color={params.row.color} label={params.value} />,
        },
    ];

    return (
        <DataTable columns={columns} rows={props.teams} disableFooter
                   defaultSort={{ field: 'title', sort: 'asc' }} pageSize={25} />
    );
}
