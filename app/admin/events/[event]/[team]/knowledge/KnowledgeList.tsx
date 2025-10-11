// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import Tooltip from '@mui/material/Tooltip';

import type { ContentRowModel, ContentScope } from '@app/api/admin/content/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <KnowledgeList> component.
 */
interface KnowledgeListProps {
    /**
     * Whether links to the author's volunteer page should be enabled.
     */
    enableAuthorLink?: boolean;

    /**
     * Scope that should be used for sourcing the knowledge.
     */
    scope: ContentScope;
}

/**
 * The <KnowledgeList> component wraps a data table that lists the questions (but not the answers!)
 * for each of the flagged action items for our teams.
 */
export function KnowledgeList(props: KnowledgeListProps) {
    const localTz = Temporal.Now.timeZoneId();
    const columns: RemoteDataTableColumn<ContentRowModel>[] = [
        {
            field: 'id',
            headerName: '',
            sortable: false,
            width: 50,
        },
        {
            field: 'categoryName',
            headerName: 'Category',
            sortable: true,
            flex: 1,
        },
        {
            field: 'title',
            headerName: 'Question',
            sortable: true,
            flex: 3,

            renderCell: params =>
                <MuiLink component={Link} href={`./knowledge/${params.row.id}`}>
                    {params.value}
                </MuiLink>,
        },
        {
            field: 'updatedOn',
            headerName: 'Last updated',
            sortable: true,
            flex: 1,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD'),
        },
        {
            field: 'updatedBy',
            headerName: 'Author',
            sortable: true,
            flex: 1,

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
        },
        {
            display: 'flex',
            field: 'contentLength',
            headerAlign: 'center',
            headerName: /* empty= */ '',
            sortable: false,
            align: 'center',
            width: 50,

            renderHeader: () =>
                <Tooltip title="Has this question been answered?">
                    <SourceOutlinedIcon fontSize="small" color="primary" />
                </Tooltip>,

            renderCell: params => {
                if (params.value < 10) {
                    return (
                        <Tooltip title="An answer still needs to be written">
                            <SourceOutlinedIcon fontSize="small" color="error" />
                        </Tooltip>
                    );
                } else if (params.value < 80) {
                    return (
                        <Tooltip title="An answer exists, but is rather short">
                            <SourceOutlinedIcon fontSize="small" color="warning" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="This question has been answered">
                            <SourceOutlinedIcon fontSize="small" color="success" />
                        </Tooltip>
                    );
                }
            },
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/content" context={props.scope}
                         defaultSort={{ field: 'categoryOrder', sort: 'asc' }} pageSize={25}
                         enableDelete subject="knowledge base article" />
    );
}
