// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import { default as MuiLink } from '@mui/material/Link';

import type { Column } from '@app/admin/components/DataTable';
import type { KnowledgeCategoriesRowModel } from './KnowledgeCategoriesDataSource';
import { CategoryIconCell, CategoryIconHeader } from './KnowledgeCategoriesCells';
import { DataTable } from '@app/admin/components/DataTable';
import { knowledgeCategoriesDataSource } from './KnowledgeCategoriesDataSource';

import { kKnowledgeBaseIconTable } from '@components/KnowledgeBaseIcon';

/**
 * Props accepted by the <KnowledgeCategories> component.
 */
interface KnowledgeCategoriesProps {
    /**
     * Unique slug of the event for which the categories are being shown.
     */
    event: string;
}

/**
 * The <KnowledgeCategories> component allows management of the knowledge categories, which indicate
 * how volunteers will find their way to the appropriate answer.
 */
export function KnowledgeCategories(props: KnowledgeCategoriesProps) {
    const { event } = props;

    const columns: Column<KnowledgeCategoriesRowModel>[] = [
        {
            display: 'flex',
            field: 'icon',
            headerAlign: 'center',
            headerName: /* empty= */ '',
            align: 'center',
            editable: true,
            sortable: false,
            width: 50,

            type: 'singleSelect',
            valueOptions: Object.keys(kKnowledgeBaseIconTable).sort().map(
                icon => ({ value: icon, label: icon })),

            template: 'component',
            templateProps: {
                component: CategoryIconCell,
                headerComponent: CategoryIconHeader,
            },
        },
        {
            field: 'title',
            headerName: 'Title',
            editable: true,
            sortable: true,
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                defaultValue: 'No description…',
            },
        },
        {
            field: 'roles',
            headerName: 'Restrict to roles…',
            editable: true,
            sortable: false,
            flex: 1,

            // TODO: Upgrade to `multiSelect`: https://github.com/mui/mui-x/pull/21157
            type: 'string',
        },
        {
            field: 'teams',
            headerName: 'Restrict to teams…',
            editable: true,
            sortable: false,
            flex: 1,

            // TODO: Upgrade to `multiSelect`: https://github.com/mui/mui-x/pull/21157
            type: 'string',
        },
        {
            field: 'order',
            headerName: 'Order',
            align: 'center',
            headerAlign: 'center',
            editable: true,
            sortable: true,
            type: 'number',
            width: 75,
        },
    ];

    return (
        <>
            <Alert severity="warning" variant="outlined">
                Role and team restrictions are a bit wonky until{' '}
                <MuiLink href="https://github.com/mui/mui-x/pull/21157">this PR</MuiLink> is merged,
                please ask Peter to make any changes to those columns for now.
            </Alert>

            <DataTable columns={columns} source={knowledgeCategoriesDataSource}
                       context={{ event }} defaultSort={{ field: 'order', sort: 'asc' }}
                       pageSize={100} disableFooter disableQueryParams subject="category"
                       listViewProps={{
                           primaryField: 'title',
                           secondaryField: 'description',
                           startComponent: CategoryIconCell,
                       }} />
        </>
    );
}
