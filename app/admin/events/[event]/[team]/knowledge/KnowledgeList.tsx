// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Column } from '@app/admin/components/DataTable';
import type { ContentRowModel } from '@app/admin/system/content/ContentDataSource';
import type { ContentScope } from '@app/admin/system/content/ContentScope';
import { AnswerCell, AnswerHeader } from './AnswerCell';
import { DataTable } from '@app/admin/components/DataTable';
import { contentDataSource } from '@app/admin/system/content/ContentDataSource';

/**
 * Props accepted by the <KnowledgeList> component.
 */
interface KnowledgeListProps {
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
    const columns: Column<ContentRowModel>[] = [
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

            template: 'text',
            templateProps: {
                href: './knowledge/{id}',
            },
        },
        {
            field: 'updatedOn',
            headerName: 'Last updated',
            sortable: true,
            width: 185,

            template: 'date',
        },
        {
            field: 'updatedBy',
            headerName: 'Author',
            sortable: true,
            flex: 1,

            template: 'account',
        },
        {
            display: 'flex',
            field: 'contentLength',
            headerAlign: 'center',
            headerName: /* empty= */ '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: AnswerHeader,
                component: AnswerCell,
            },
        }
    ];

    return (
        <DataTable
            columns={columns}
            source={contentDataSource}
            context={props.scope}
            defaultSort={{ field: 'categoryName', sort: 'asc' }}
            pageSize={25}
            subject="knowledge base article"
            listViewProps={{
                primaryField: 'title',
                secondaryField: 'categoryName',
                dateField: 'updatedOn',
                dateFieldFormat: 'YYYY-MM-DD',
                linkTemplate: './knowledge/{id}',
                startComponent: AnswerCell,
            }}
        />
    );
}
