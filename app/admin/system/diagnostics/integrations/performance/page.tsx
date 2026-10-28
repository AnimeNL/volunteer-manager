// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import ApiIcon from '@mui/icons-material/Api';

import { IntegrationPerformanceGraph, type IntegrationPerformancePoint }
    from './IntegrationPerformanceGraph';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tIntegrationsLogs } from '@lib/database';

import { kIntegrationLogTarget } from '@lib/database/Types';

/**
 * Schema for requesting performance data of a specific `{integration, operation}` pair.
 */
const kFetchPerformanceDataSchema = z.object({
    integration: z.enum(kIntegrationLogTarget),
    operation: z.string().min(1),
});

/**
 * Server Action that fetches the TTFB and response times over the past three months for the
 * selected `{integration, operation}` pair.
 */
async function fetchIntegrationPerformance(input: unknown) {
    'use server';
    return executeServerAction(input, kFetchPerformanceDataSchema, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            permission: 'system.logs',
            operation: 'read',
        });

        const cutoffDate = Temporal.Now.zonedDateTimeISO('UTC').subtract({ months: 3 });

        const logs = await db.selectFrom(tIntegrationsLogs)
            .where(tIntegrationsLogs.logIntegration.equals(data.integration))
                .and(tIntegrationsLogs.logOperation.equals(data.operation))
                .and(tIntegrationsLogs.logDate.greaterOrEqual(cutoffDate))
                .and(tIntegrationsLogs.logDurationMs.isNotNull().or(
                     tIntegrationsLogs.logDurationTtfbMs.isNotNull()))
            .select({
                date: tIntegrationsLogs.logDate,
                durationMs: tIntegrationsLogs.logDurationMs,
                ttfbMs: tIntegrationsLogs.logDurationTtfbMs,
            })
            .orderBy(tIntegrationsLogs.logDate, 'asc')
                .orderBy(tIntegrationsLogs.logId, 'asc')
            .executeSelectMany();

        const points: IntegrationPerformancePoint[] = [];

        let previousTimestamp = 0;
        for (const log of logs) {
            const timestamp = Math.max(log.date.epochMilliseconds, previousTimestamp + 1);
            previousTimestamp = timestamp;

            points.push({
                timestamp,
                ttfbMs: log.ttfbMs ?? null,
                durationMs: log.durationMs ?? null,
            });
        }

        return {
            success: true,
            points,
        };
    });
}

/**
 * The integration performance page allows administrators to inspect the TTFB and total response
 * times of external integration operations over the past three months.
 */
export default async function IntegrationPerformancePage() {
    await requireAuthentication({
        permission: 'system.logs',
        operation: 'read',
    });

    const operations = await db.selectDistinctFrom(tIntegrationsLogs)
        .select({
            integration: tIntegrationsLogs.logIntegration,
            operation: tIntegrationsLogs.logOperation,
        })
        .orderBy('integration', 'asc')
            .orderBy('operation', 'asc')
        .executeSelectMany();

    return (
        <>
            <Section icon={ <ApiIcon color="primary" /> } title="Integration performance"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         {
                             label: 'Integration logs',
                             href: '/admin/system/diagnostics/integrations',
                         },
                         { label: 'Performance' },
                     ]}>
                <SectionIntroduction>
                    Performance overview of external API calls made by the Volunteer Manager over
                    the past three months, mapping time to first byte (TTFB) and total response
                    times.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <IntegrationPerformanceGraph action={fetchIntegrationPerformance}
                                             operations={operations} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Performance', 'Integration logs', 'Diagnostics', 'System');
