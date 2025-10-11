// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';

import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

import type { EventScheduleHistoryContext, EventScheduleHistoryRowModel }
    from '@app/api/admin/event/schedule/history/[[...id]]/route';

/**
 * Props accepted by the <ScheduleHistoryTable> component.
 */
interface ScheduleHistoryTableProps extends EventScheduleHistoryContext {
    /**
     * Whether the volunteer is able to delete history items.
     */
    enableDelete?: boolean;

    /**
     * Whether users should be linked through to their profile pages.
     */
    enableProfileLinks?: boolean;
}

/**
 * The <ScheduleHistoryTable> component displays the most recent changes to the schedule in a table,
 * to * provide some insight in which volunteers made which modifications. This is helpful to
 * understand the most recent changes that have been made.
 */
export function ScheduleHistoryTable(props: ScheduleHistoryTableProps) {
    const localTz = Temporal.Now.timeZoneId();

    const columns: RemoteDataTableColumn<EventScheduleHistoryRowModel>[] = [
        ...(
            !!props.enableDelete ? [
                {
                    field: 'id',
                    headerName: '',
                    sortable: false,
                    width: 50,
                },
            ] : []
        ),
        {
            field: 'userId',
            headerName: 'User',
            sortable: false,
            flex: 1,

            renderCell: params => {
                if (!props.enableProfileLinks)
                    return params.row.user;

                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.row.userId}`}>
                        {params.row.user}
                    </MuiLink>
                );
            },
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: false,
            flex: 1,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss'),
        },
        {
            field: 'mutation',
            headerName: 'Mutation',
            sortable: false,
            flex: 4,
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/event/schedule/history"
                         enableDelete={!!props.enableDelete} context={props.context}
                         defaultSort={{ field: 'id', sort: 'desc' }} pageSize={10}
                         subject="log entry" />
    );
}
