// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import { default as MuiLink } from '@mui/material/Link';

import { type OldDataTableColumn, OldDataTable } from '@app/admin/components/OldDataTable';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';

/**
 * Props accepted by the <ViewingHistoryTable> component.
 */
interface ViewingHistoryTableProps {
    /**
     * Whether linking through to the viewer's account should be enabled.
     */
    enableAccountLinks?: boolean;

    /**
     * The list of people who have viewed this incident.
     */
    viewers: {
        /**
         * Unique ID of the user who read the incident.
         */
        id: number;

        /**
         * Date at which the incident was read. In a Temporal ZDT-compatible serialisation.
         */
        date: string;

        /**
         * Name of the user who read the incident.
         */
        name: string;

    }[];
}

/**
 * The <ViewingHistoryTable> component displays a table with the volunteers who have read the
 * details of a particular incident at least once.
 */
export function ViewingHistoryTable(props: ViewingHistoryTableProps) {
    const columns: OldDataTableColumn<ViewingHistoryTableProps['viewers'][number]>[] = [
        {
            field: 'date',
            headerName: 'Viewed on',
            width: 175,

            renderCell: params =>
                <LocalDateTime dateTime={params.value} format="YYYY-MM-DD HH:mm:ss" />,
        },
        {
            field: 'name',
            headerName: 'Viewed by',
            flex: 1,

            renderCell: params => {
                if (!props.enableAccountLinks)
                    return params.value;

                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.row.id}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        }
    ];

    return (
        <OldDataTable columns={columns} defaultSort={{ field: 'name', sort: 'asc' }}
                      rows={props.viewers} pageSize={100} disableFooter />
    );
}
