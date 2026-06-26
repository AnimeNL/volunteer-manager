// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { z } from 'zod/v4';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { IssueTypeCell, LocalBuildCell } from './IssueTypeCell';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tErrorLogs, tUsers } from '@lib/database';

import { kErrorSource } from '@lib/database/Types';
import { kLogSeverity } from '@lib/Log';

/**
 * Data source through which the error logs can be retrieved.
 */
const errorLogsDataSource = createDataSource('admin/system/diagnostics/errors', withRowModel({
    /**
     * Unique ID of the entry.
     */
    id: z.number(),

    /**
     * Date at which the error occurred.
     */
    date: z.string(),

    /**
     * Source or type of error that was stored.
     */
    source: z.enum(kErrorSource),

    /**
     * The severity assigned to the error.
     */
    severity: z.enum(kLogSeverity),

    /**
     * Textual representation of what happened.
     */
    message: z.string(),

    /**
     * Name of the person or entity who ran in to the error, if any.
     */
    user: z.object({
        id: z.number().optional(),
        name: z.string(),
    }).optional(),

    /**
     * Text representation of the user for mobile display.
     */
    userLabel: z.string(),

    /**
     * Whether the error happened on a local development server. These are filtered out from
     * production builds by default to minimise the amount of noise.
     */
    isLocal: z.boolean().optional(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'system.logs',
                operation: 'read',
            },
        });
    },

    async list(params, props) {
        let sortField: 'date' | 'source' | 'severity' | 'message' | 'user' = 'date';
        switch (params.sort.field) {
            case 'date':
            case 'source':
            case 'severity':
            case 'message':
            case 'user':
                sortField = params.sort.field as any;
                break;
        }

        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const errors = await dbInstance.selectFrom(tErrorLogs)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tErrorLogs.errorUserId))
            .where(
                tErrorLogs.errorMessage.containsIfValue(params.search)
                    .or(usersJoin.name.containsIfValue(params.search)))
            .and(tErrorLogs.errorIpAddress.notEquals('::1').onlyWhen(
                !process.env.APP_ENVIRONMENT_OVERRIDE))
            .select({
                id: tErrorLogs.errorId,
                date: dbInstance.dateTimeAsString(tErrorLogs.errorDate),
                source: tErrorLogs.errorSource,
                severity: tErrorLogs.errorSeverity,
                message: tErrorLogs.errorMessage,
                user: usersJoin.name,
                userId: usersJoin.userId,
                isLocal: tErrorLogs.errorIpAddress.equals('::1'),
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: errors.count,
            rows: errors.data.map(row => ({
                ...row,
                user: row.userId ? { id: row.userId, name: row.user || '' } : undefined,
                userLabel: row.user || 'Anonymous',
            })),
        };
    },
});

/**
 * The error logs page displays an overview of the issues that have occurred on the volunteer
 * manager, i.e. both client-side and server-side JavaScript errors. They're tracked for system
 * resiliency purposes.
 */
export default async function ErrorLogsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const columns: Column<ExtractRowModel<typeof errorLogsDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,
            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: './errors/{id}',
            },
        },
        {
            field: 'severity',
            headerName: '',
            template: 'severity',
        },
        {
            field: 'source',
            headerAlign: 'center',
            headerName: 'Issue type',
            sortable: true,
            width: 100,
            align: 'center',
            template: 'component',
            templateProps: {
                component: IssueTypeCell,
            },
        },
        {
            field: 'message',
            headerName: 'Message',
            sortable: false,
            flex: 3,
            template: 'text',
            templateProps: {
                href: './errors/{id}',
            },
        },
        {
            field: 'user',
            headerName: 'Account',
            sortable: true,
            flex: 1,
            template: 'account',
            templateProps: {
                noAccountLabel: 'Anonymous',
            },
        },
    ];

    if (!!process.env.APP_ENVIRONMENT_OVERRIDE) {
        columns.push({
            field: 'isLocal',
            headerName: '',
            sortable: false,
            width: 80,
            align: 'center',
            template: 'component',
            templateProps: {
                component: LocalBuildCell,
            },
        });
    }

    return (
        <DataTable
            columns={columns}
            source={errorLogsDataSource}
            defaultSort={{ field: 'date', sort: 'desc' }}
            listViewProps={{
                primaryField: 'message',
                secondaryTemplate: '{userLabel} ({severity})',
                dateField: 'date',
                linkTemplate: './errors/{id}',
            }}
        />
    );
}

export const metadata: Metadata = {
    title: 'Error logs | AnimeCon Volunteer Manager',
};
