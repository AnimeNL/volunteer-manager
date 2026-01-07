// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../../createDataTableApi';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tErrorLogs, tUsers } from '@lib/database';

import { kErrorSource } from '@lib/database/Types';
import { kLogSeverity } from '@lib/Log';

/**
 * Row model for an error log message describing an error that occurred on the Volunteer Manager.
 */
const kErrorLogsRowModel = z.object({
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
    user: z.string().optional(),

    /**
     * Unique ID of the person who ran in to the error, if any.
     */
    userId: z.number().optional(),

    /**
     * Whether the error happened on a local development server. These are filtered out from
     * production builds by default to minimise the amount of noise.
     */
    isLocal: z.boolean().optional(),
});

/**
 * The Error Logs API does not require any context.
 */
const kErrorLogsContext = z.never();

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type ErrorLogsEndpoints =
    DataTableEndpoints<typeof kErrorLogsRowModel, typeof kErrorLogsContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type ErrorLogsRowModel = z.infer<typeof kErrorLogsRowModel>;

/**
 * This is implemented as a regular DataTable API. The following endpoints are provided by this
 * implementation:
 *
 *     GET /api/admin/system/diagnostics/errors
 */
export const { GET } = createDataTableApi(kErrorLogsRowModel, kErrorLogsContext, {
    async accessCheck(request, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'system.logs',
                operation: 'read',
            },
        });
    },

    async list({ pagination, sort }) {
        const usersJoin = tUsers.forUseInLeftJoin();

        const errors = await db.selectFrom(tErrorLogs)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tErrorLogs.errorUserId))
            .select({
                id: tErrorLogs.errorId,
                date: db.dateTimeAsString(tErrorLogs.errorDate),
                source: tErrorLogs.errorSource,
                severity: tErrorLogs.errorSeverity,
                message: tErrorLogs.errorMessage,
                user: usersJoin.name,
                userId: usersJoin.userId,
                isLocal: tErrorLogs.errorIpAddress.equals('::1'),
            })
            .orderBy(sort?.field || 'date', sort?.sort || 'desc')
            .limitIfValue(pagination?.pageSize)
            .offsetIfValue(pagination ? pagination.page * pagination.pageSize
                                      : undefined)
            .executeSelectPage();

        return {
            success: true,
            rowCount: errors.count,
            rows: errors.data,
        };
    },
});
