// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import ApiIcon from '@mui/icons-material/Api';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { IntegrationCell, StatusCell, StatusHeader } from './IntegrationLogsCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck, and } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tIntegrationsLogs } from '@lib/database';

import { kIntegrationLogStatus, kIntegrationLogTarget } from '@lib/database/Types';

/**
 * Data source through which integration log entries can be retrieved.
 */
const integrationLogsDataSource = createDataSource(
    'admin/system/diagnostics/integrations', withRowModel(
{
    /**
     * Unique ID of the log entry.
     */
    id: z.number(),

    /**
     * Date and time at which the integration call occurred.
     */
    date: z.string(),

    /**
     * External integration target that was called.
     */
    integration: z.enum(kIntegrationLogTarget),

    /**
     * Operation that was executed against the integration.
     */
    operation: z.string(),

    /**
     * Time to first byte (TTFB), formatted in milliseconds when recorded.
     */
    durationTtfbMs: z.string().optional(),

    /**
     * Total duration of the call, formatted in milliseconds when recorded.
     */
    durationMs: z.string().optional(),

    /**
     * Outcome status of the integration call.
     */
    status: z.enum(kIntegrationLogStatus),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, and(
        {
            permission: 'system.integrations',
        },
        {
            permission: 'system.logs',
            operation: 'read',
        }));
    },

    async list(params) {
        let sortField:
            'date' | 'integration' | 'operation' | 'durationTtfbMs' | 'durationMs' | 'status'
            = 'date';

        switch (params.sort.field) {
            case 'date':
            case 'integration':
            case 'operation':
            case 'durationTtfbMs':
            case 'durationMs':
            case 'status':
                sortField = params.sort.field;
                break;
        }

        const dbInstance = db;
        const logs = await dbInstance.selectFrom(tIntegrationsLogs)
            .where(tIntegrationsLogs.logOperation.containsInsensitiveIfValue(params.search))
            .select({
                id: tIntegrationsLogs.logId,
                date: dbInstance.dateTimeAsString(tIntegrationsLogs.logDate),
                integration: tIntegrationsLogs.logIntegration,
                operation: tIntegrationsLogs.logOperation,
                durationTtfbMs: tIntegrationsLogs.logDurationTtfbMs,
                durationMs: tIntegrationsLogs.logDurationMs,
                status: tIntegrationsLogs.logStatus,
            })
            .orderBy(sortField, params.sort.direction)
                .orderBy('id', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: logs.count,
            rows: logs.data.map(row => ({
                ...row,
                durationTtfbMs: row.durationTtfbMs !== undefined
                    ? `${Math.round(row.durationTtfbMs * 10) / 10}ms`
                    : undefined,
                durationMs: row.durationMs !== undefined
                    ? `${Math.round(row.durationMs * 10) / 10}ms`
                    : undefined,
            })),
        };
    },
});

/**
 * The integration logs page displays an overview of the API calls made by the Volunteer Manager,
 * including their input, output and response times.
 */
export default async function IntegrationLogsPage() {
    await requireAuthentication(and(
    {
        permission: 'system.integrations',
    },
    {
        permission: 'system.logs',
        operation: 'read',
    }));

    const columns: Column<ExtractRowModel<typeof integrationLogsDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,
            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: './integrations/{id}',
            },
        },
        {
            field: 'integration',
            headerName: 'Integration',
            sortable: true,
            flex: 1,
            template: 'component',
            templateProps: {
                component: IntegrationCell,
            },
        },
        {
            field: 'operation',
            headerName: 'Operation',
            sortable: true,
            flex: 2,
            template: 'text',
        },
        {
            field: 'durationTtfbMs',
            headerAlign: 'right',
            headerName: 'TTFB (ms)',
            description: 'Time elapsed until the first byte of the response arrived',
            sortable: true,
            align: 'right',
            flex: 1,
            template: 'text',
        },
        {
            field: 'durationMs',
            headerAlign: 'right',
            headerName: 'Duration (ms)',
            description: 'Total time elapsed for the integration call to complete',
            sortable: true,
            align: 'right',
            flex: 1,
            template: 'text',
        },
        {
            field: 'status',
            headerAlign: 'center',
            headerName: '',
            sortable: true,
            align: 'center',
            width: 50,
            template: 'component',
            templateProps: {
                headerComponent: StatusHeader,
                component: StatusCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <ApiIcon color="primary" /> } title="Integration logs"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'Integration logs' },
                     ]}>
                <SectionIntroduction>
                    Overview of the external API calls made by the Volunteer Manager, including
                    their input, output and response times.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <DataTable columns={columns}
                           source={integrationLogsDataSource}
                           defaultSort={{ field: 'date', sort: 'desc' }}
                           listViewProps={{
                               primaryField: 'operation',
                               secondaryField: 'integration',
                               dateField: 'date',
                               startComponent: StatusCell,
                               linkTemplate: './integrations/{id}',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Integration logs', 'Diagnostics', 'System');
