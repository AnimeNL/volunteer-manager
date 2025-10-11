// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import type { ContentRowModel, ContentScope } from '@app/api/admin/content/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '../components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <ContentList> component.
 */
interface ContentListProps {
    /**
     * Enables whether the author should be a link through to their account page. Those pages are
     * not available to everyone, hence why this must be explicitly enabled.
     */
    enableAuthorLink?: boolean;

    /**
     * Prefix to display at the beginning of the content's path.
     */
    pathPrefix?: string;

    /**
     * Scope of the content that should be editable.
     */
    scope: ContentScope;
}

/**
 * The <ContentList> component displays a list of content items that already exist, each of which
 * can be edited by clicking on a cell in the data table. The actual content will be fetched from
 * the server using an API call.
 */
export function ContentList(props: ContentListProps) {
    const localTz = Temporal.Now.timeZoneId();
    const columns: RemoteDataTableColumn<ContentRowModel>[] = [
        {
            field: 'id',
            headerName: '',
            sortable: false,
            width: 50,

            isProtected: params => !!params.row.protected,
        },
        {
            field: 'path',
            headerName: 'Content path',
            sortable: true,
            flex: 3,

            renderCell: params => {
                const href = `./content/${params.row.id}`;
                if (!props.pathPrefix) {
                    return (
                        <MuiLink component={Link} href={href}>
                            {params.value}
                        </MuiLink>
                    );
                }

                return (
                    <MuiLink component={Link} href={href} noWrap>
                        <Typography component="span" variant="body2" paragraph={false}>
                            <Typography component="span" variant="body2"
                                        sx={{ color: 'text.disabled' }}>
                                {props.pathPrefix}
                            </Typography>
                            {params.value}
                        </Typography>
                    </MuiLink>
                );
            },
        },
        {
            field: 'title',
            headerName: 'Content title',
            sortable: true,
            flex: 3,
        },
        {
            field: 'updatedOn',
            headerName: 'Last updated',
            sortable: true,
            flex: 2,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD'),
        },
        {
            field: 'updatedBy',
            headerName: 'Author',
            sortable: true,
            flex: 3,

            renderCell: params => {
                if (!props.enableAuthorLink)
                    return params.value;

                const href = `/admin/organisation/accounts/${params.row.updatedByUserId}`;
                return (
                    <MuiLink component={Link} href={href}>
                        {params.value}
                    </MuiLink>
                );
            },
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/content" context={props.scope}
                         enableDelete subject="content"
                         defaultSort={{ field: 'path', sort: 'asc' }}  />
    );
}
