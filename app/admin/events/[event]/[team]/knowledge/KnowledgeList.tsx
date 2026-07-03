// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import type { ContentScope } from '@app/admin/system/content/ContentScope';
import { AnswerCell, AnswerHeader } from './AnswerCell';
import { DataTable, type Column } from '@app/admin/components/DataTable';
import { contentDataSource, type ContentRowModel } from '@app/admin/system/content/ContentDataSource';

/**
 * Props accepted by the <KnowledgeList> component.
 */
interface KnowledgeListProps {
    /**
     * Authentication context representing the signed in user.
     */
    authenticationContext: AuthenticationContext;

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
            flex: 1,

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
            source={contentDataSource.authorize(props.authenticationContext, props.scope)}
            context={props.scope}
            defaultSort={{ field: 'categoryOrder', sort: 'asc' }}
            pageSize={25}
            subject="knowledge base article"
            listViewProps={{
                primaryField: 'title',
                secondaryField: 'categoryName',
                dateField: 'updatedOn',
                dateFieldFormat: 'YYYY-MM-DD',
                startComponent: AnswerCell,
            }}
        />
    );
}
