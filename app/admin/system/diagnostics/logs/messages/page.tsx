// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';

import { BooleanCell, BooleanHeader } from '@app/admin/components/DataTable/cells/BooleanCell';
import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tLogsFormat } from '@lib/database';

/**
 * Data source through which the log message formatting configuration can be retrieved.
 */
const logsFormatDataSource = createDataSource('admin/system/diagnostics/logs/messages', withRowModel({
    /**
     * The unique identifier (log type) of this row.
     */
    id: z.string(),

    /**
     * Whether this log type is still being recorded.
     */
    active: z.boolean(),

    /**
     * Whether this log type is visible.
     */
    visible: z.boolean(),

    /**
     * The format template string.
     */
    format: z.string().optional(),

    /**
     * The date/time at which the format was last updated.
     */
    updated: z.string(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.settings',
        });
    },

    async create(row, props, context) {
        if (!row.id || !row.format)
            return false;  // required fields omitted

        const dbInstance = db;
        const success = await dbInstance.insertInto(tLogsFormat)
            .set({
                logType: row.id,
                logFormat: row.format,
                logTypeDeprecated: row.active ? 0 : 1,
                logTypeVisible: row.visible ? 1 : 0,
                logFormatUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!success)
            return false;

        LogBuilder.for('CreateLogMessageFormat')
            .withInitiatorUser(props.user)
            .record({ type: row.id });

        return true;
    },

    async list(params, props) {
        let sortField: 'id' | 'active' | 'visible' | 'format' | 'updated' = 'id';
        switch (params.sort.field) {
            case 'id':
            case 'active':
            case 'visible':
            case 'format':
            case 'updated':
                sortField = params.sort.field as any;
                break;
        }

        const dbInstance = db;
        const formats = await dbInstance.selectFrom(tLogsFormat)
            .where(
                tLogsFormat.logType.containsInsensitiveIfValue(params.search).or(
                tLogsFormat.logFormat.containsInsensitiveIfValue(params.search)
            ))
            .select({
                id: tLogsFormat.logType,
                active: tLogsFormat.logTypeDeprecated.equals(/* false= */ 0),
                visible: tLogsFormat.logTypeVisible.equals(/* true= */ 1),
                format: tLogsFormat.logFormat,
                updated: dbInstance.dateTimeAsString(tLogsFormat.logFormatUpdated),
            })
            .orderBy('active', 'desc')
                .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: formats.count,
            rows: formats.data,
        };
    },

    async update(updatedRow, previousRow, props) {
        const updated = Temporal.Now.zonedDateTimeISO();

        await db.update(tLogsFormat)
            .set({
                logTypeDeprecated: updatedRow.active ? 0 : 1,
                logTypeVisible: updatedRow.visible ? 1 : 0,
                logFormat: updatedRow.format,
                logFormatUpdated: updated,
            })
            .where(tLogsFormat.logType.equals(updatedRow.id))
            .executeUpdate();

        LogBuilder.for('UpdateLogMessageFormat')
            .withInitiatorUser(props.user)
            .withDiff({
                format: {
                    before: previousRow.format!,
                    after: updatedRow.format!,
                },
                visible: {
                    before: previousRow.visible,
                    after: updatedRow.visible,
                },
            })
            .record({ type: updatedRow.id });

        return { ...updatedRow, updated: updated.toString() };
    }
});

/**
 * Page through which administrators are able to manage message formatting, i.e. how log entries
 * should be presented on the log overview page. Restricted to administrators as this is relatively
 * easy to mess up.
 */
export default async function SystemLogsMessageFormattingPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    const columns: Column<ExtractRowModel<typeof logsFormatDataSource>>[] = [
        {
            field: 'visible',
            headerAlign: 'center',
            headerName: 'Visible',
            description: 'Display these log messages?',
            align: 'center',
            editable: true,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                component: BooleanCell,
                componentContext: {
                    field: 'visible',
                    tooltips: {
                        header: 'Display log messages?',
                        falsyValue: 'Messages will be hidden',
                        truthyValue: 'Messages will be shown',
                    },
                },
                headerComponent: BooleanHeader,
            },
        },
        {
            field: 'id',
            headerName: 'Type',
            editable: true,
            flex: 1,

            editorProps: {
                placeholder: 'YourTypeName',
                required: true,
            },
        },
        {
            field: 'format',
            headerName: 'Format',
            editable: true,
            flex: 2,

            editorProps: {
                placeholder: 'The actual log message',
                required: true,
            },
        },
        {
            field: 'active',
            headerAlign: 'center',
            headerName: 'Active',
            description: 'Are ongoing logs expected?',
            align: 'center',
            editable: true,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                component: BooleanCell,
                componentContext: {
                    field: 'active',
                    tooltips: {
                        header: 'Is this type still active?',
                        falsyValue: 'No longer being recorded',
                        truthyValue: 'Actively being recorded',
                    },
                },
                headerComponent: BooleanHeader,
            },
        },
        {
            field: 'updated',
            headerName: 'Updated',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
    ];

    return (
        <>
            <Section icon={ <ReceiptOutlinedIcon color="primary" /> } title="Message formatting"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'System logs', href: '/admin/system/diagnostics/logs' },
                         { label: 'Message formatting' },
                     ]}>
                <SectionIntroduction>
                    Log messages and the formatting rules through which they should be presented.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={logsFormatDataSource}
                           defaultSort={{ field: 'id', sort: 'asc' }}
                           subject="log message format"
                           listViewProps={{
                               primaryField: 'id',
                               secondaryField: 'format',
                               startComponent: BooleanCell,
                               startComponentContext: { field: 'visible' },
                           }} />
            </Section>
        </>
    );
}


export const generateMetadata =
    createGenerateMetadataFn('Message formatting', 'System logs', 'Diagnostics', 'System');
