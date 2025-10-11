// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';

import type { NardoRowModel } from '@app/api/nardo/[[...id]]/route';
import { type RemoteDataTableColumn, RemoteDataTable } from '../../components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * The <AdviceDataTable> component displays the pieces of advice that Del a Rie Advies is able to
 * issue to volunteers. Pieces can be added, updated and deleted.
 */
export function AdviceDataTable() {
    const localTz = Temporal.Now.timeZoneId();

    const columns: RemoteDataTableColumn<NardoRowModel>[] = [
        {
            field: 'id',
            headerName: /* empty= */ '',
            sortable: false,
            width: 50,
        },
        {
            field: 'advice',
            headerName: 'Advice',
            sortable: true,
            editable: true,
            flex: 3,
        },
        {
            field: 'authorName',
            headerName: 'Author',
            sortable: true,
            filterable: true,
            flex: 1,

            renderCell: params => {
                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.row.authorUserId}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: true,
            flex: 1,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD'),
        },
    ];

    return <RemoteDataTable columns={columns} endpoint="/api/nardo"
                            defaultSort={{ field: 'date', sort: 'desc' }}
                            enableCreate enableDelete enableUpdate enableQueryParams
                            subject="piece of advice" />;
}
