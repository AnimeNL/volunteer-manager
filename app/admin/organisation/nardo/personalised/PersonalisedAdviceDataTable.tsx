// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';

import type { NardoPersonalisedRowModel } from '@app/api/nardo/personalised/[[...id]]/route';
import { type RemoteDataTableColumn, RemoteDataTable } from '../../../components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * The <PersonalisedAdviceDataTable> component displays the generated, personalised pieces of advice
 * that Del a Rie Advies has generated for our volunteers.
 */
export function PersonalisedAdviceDataTable() {
    const localTz = Temporal.Now.timeZoneId();

    const columns: RemoteDataTableColumn<NardoPersonalisedRowModel>[] = [
        {
            field: 'date',
            headerName: 'Date',
            sortable: true,
            flex: 1,

            renderCell: params => {
                const link = `/admin/organisation/nardo/personalised/${params.row.id}`;
                const date = formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss');

                return (
                    <MuiLink component={Link} href={link}>
                        {date}
                    </MuiLink>
                );
            }

        },
        {
            field: 'userName',
            headerName: 'Volunteer',
            sortable: true,
            filterable: true,
            flex: 1,

            renderCell: params => {
                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.row.userId}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'output',
            headerName: 'Advice',
            sortable: true,
            flex: 3,
        }
    ];

    return <RemoteDataTable columns={columns} endpoint="/api/nardo/personalised"
                            defaultSort={{ field: 'date', sort: 'desc' }}
                            subject="piece of advice" />;
}
