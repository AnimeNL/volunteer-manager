// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ContentScope } from './ContentScope';
import { DataTable, type Column } from '../../components/DataTable';
import { contentDataSource, type ContentRowModel } from './ContentDataSource';

/**
 * Props accepted by the <ContentList> component.
 */
interface ContentListProps {
    /**
     * Prefix to apply to links to content management pages shown in the table.
     * @default "./content/"
     */
    linkPrefix?: string;

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
    const columns: Column<ContentRowModel>[] = [
        {
            field: 'path',
            headerName: 'Content path',
            sortable: true,
            flex: 3,

            template: 'text',
            templateProps: {
                href: `${props.linkPrefix ?? './content/'}{id}`,
                prefix: props.pathPrefix,
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

            template: 'date',
        },
        {
            field: 'updatedBy',
            headerName: 'Author',
            sortable: true,
            flex: 3,

            template: 'account',
        }
    ];

    return (
        <DataTable
            columns={columns}
            source={contentDataSource}
            context={props.scope}
            defaultSort={{ field: 'path', sort: 'asc' }}
            protectedColumn="protected"
            subject="page"
            listViewProps={{
                primaryField: 'title',
                secondaryField: 'path',
                dateField: 'updatedOn',
                dateFieldFormat: 'YYYY-MM-DD',
            }}
        />
    );
}
