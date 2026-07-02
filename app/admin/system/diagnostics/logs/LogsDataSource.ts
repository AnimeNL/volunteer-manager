// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import type { ExtractRowModel } from '@app/admin/components/DataTable';
import { createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tLogs, tLogsFormat, tUsers } from '@lib/database';
import { resolveTemplate } from '@app/admin/components/DataTable/Utilities';

/**
 * Data source used to populate the system logs table.
 */
export const logsDataSource = createDataSource('system/diagnostics/logs', withContext({
    /**
     * Optional filter indicating for which user logs should be retrieved.
     */
    userId: z.number().optional(),

}), withRowModel({
    /**
     * Unique ID of this log entry.
     */
    id: z.number(),

    /**
     * Date at which the log message was stored in the database.
     */
    date: z.string(),

    /**
     * The severity assigned to the log entry.
     */
    severity: z.string(),

    /**
     * Message
     */
    message: z.string(),

    /**
     * Account information of the person who was affected by this change.
     */
    affectedUser: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

    /**
     * Account information of the person who initiated this change.
     */
    initiatorUser: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'system.logs',
                operation: operation,
            },
        });
    },

    async delete(params, props, context) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tLogs)
            .set({
                logDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tLogs.logId.equals(params.id))
            .executeUpdate();

        return !!affectedRows;
    },

    async list(params, props, context) {
        const affectedUserJoin = tUsers.forUseInLeftJoinAs('auj');
        const initiatorUserJoin = tUsers.forUseInLeftJoinAs('iuj');
        const formatJoin = tLogsFormat.forUseInLeftJoin();

        let sortField: 'date' | 'message' | 'severity' | 'affectedUser.name' | 'initiatorUser.name';
        switch (params.sort.field) {
            case 'message':
            case 'severity':
                sortField = params.sort.field as 'message' | 'severity';
                break;

            case 'affectedUser':
                sortField = 'affectedUser.name';
                break;

            case 'initiatorUser':
                sortField = 'initiatorUser.name';
                break;

            default:
                sortField = 'date';
                break;
        }

        const dbInstance = db;
        const rows = await dbInstance.selectFrom(tLogs)
            .leftJoin(formatJoin)
                .on(formatJoin.logType.equals(tLogs.logType))
            .leftJoin(affectedUserJoin)
                .on(affectedUserJoin.userId.equals(tLogs.logTargetUserId))
            .leftJoin(initiatorUserJoin)
                .on(initiatorUserJoin.userId.equals(tLogs.logSourceUserId))
            .where(tLogs.logSourceUserId.equalsIfValue(context.userId).or(
                tLogs.logTargetUserId.equalsIfValue(context.userId)))
                .and(tLogs.logDeleted.isNull())
                .and(tLogs.logData.containsInsensitiveIfValue(params.search).or(
                    affectedUserJoin.name.containsInsensitiveIfValue(params.search).or(
                    initiatorUserJoin.name.containsInsensitiveIfValue(params.search))))
            .select({
                id: tLogs.logId,
                date: dbInstance.dateTimeAsString(tLogs.logDate),
                severity: tLogs.logSeverity,
                message: tLogs.logType,
                affectedUser: {
                    id: affectedUserJoin.userId,
                    name: affectedUserJoin.name,
                },
                initiatorUser: {
                    id: initiatorUserJoin.userId,
                    name: initiatorUserJoin.name,
                },

                // Fields that will be processed:
                data: tLogs.logData,
                format: formatJoin.logFormat,
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: rows.count,
            rows: rows.data.map(row => {
                const { data, format, ...rest } = row;

                // Simply return the `rest` when no format has been defined for this log type, as
                // there is no formatting that can be done at this point.
                if (!format)
                    return rest;

                let dataObject = { /* no data */ };
                if (!!data) {
                    try {
                        dataObject = JSON.parse(data);

                    } catch (_error) { /* ignore */ }
                }

                const message = resolveTemplate({
                    ...dataObject,
                    source: row.initiatorUser?.name,
                    target: row.affectedUser?.name,

                }, format);

                return { ...rest, message };
            }),
        };
    },
});

/**
 * Export type definition for the API's Row Model.
 */
export type LogsRowModel = ExtractRowModel<typeof logsDataSource>;
