// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import SpeedIcon from '@mui/icons-material/Speed';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { WebVitalsDashboard, type WebVitalSeriesPoint } from './WebVitalsDashboard';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeServerAction } from '@lib/serverAction';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/auth';
import { summarizeRouteVitals } from './computeVitalsSummary';
import db, { tWebVitals } from '@lib/database';

import { kWebVitalDeviceType, kWebVitalNavigationType } from '@lib/database/Types';

/**
 * Schema for querying Web Vitals time-series data for a specific normalized route.
 */
const kFetchRouteVitalsSchema = z.object({
    route: z.string().min(1),
    deviceType: z.enum([ 'All', 'Desktop', 'Mobile' ]).default('All'),
    navigationScope: z.enum([ 'All', 'Hard', 'Soft' ]).default('All'),
});

/**
 * Server Action that fetches up to 3 months of Web Vitals measurements for a single route.
 */
async function fetchRouteVitals(input: unknown) {
    'use server';
    return executeServerAction(input, kFetchRouteVitalsSchema, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'system.logs',
            operation: 'read',
        });

        const cutoffDate = Temporal.Now.zonedDateTimeISO('UTC').subtract({ months: 3 });

        let query = db.selectFrom(tWebVitals)
            .where(tWebVitals.vitalRoute.equals(data.route))
                .and(tWebVitals.vitalDate.greaterOrEqual(cutoffDate));

        if (data.deviceType === 'Desktop')
            query = query.and(tWebVitals.vitalDeviceType.equals(kWebVitalDeviceType.Desktop));
        else if (data.deviceType === 'Mobile')
            query = query.and(tWebVitals.vitalDeviceType.equals(kWebVitalDeviceType.Mobile));

        if (data.navigationScope === 'Soft') {
            query = query.and(
                tWebVitals.vitalNavigationType.equals(kWebVitalNavigationType.SoftNavigation));
        } else if (data.navigationScope === 'Hard') {
            query = query.and(
                tWebVitals.vitalNavigationType.notEquals(kWebVitalNavigationType.SoftNavigation));
        }

        const rows = await query
            .select({
                date: tWebVitals.vitalDate,
                metric: tWebVitals.vitalMetric,
                value: tWebVitals.vitalValue,
                buildHash: tWebVitals.vitalBuildHash,
            })
            .orderBy(tWebVitals.vitalDate, 'asc')
                .orderBy(tWebVitals.vitalId, 'asc')
            .executeSelectMany();

        const points: WebVitalSeriesPoint[] = [];
        let lastTimestamp = 0;

        for (const row of rows) {
            const timestamp = Math.max(row.date.epochMilliseconds, lastTimestamp + 1);
            lastTimestamp = timestamp;

            points.push({
                timestamp,
                metric: row.metric,
                value: row.value,
                buildHash: row.buildHash,
            });
        }

        return {
            success: true,
            points,
        };
    });
}

/**
 * Diagnostics page displaying per-route Core Web Vitals (TTFB, FCP, LCP, INP, CLS) collected
 * across the portal.
 */
export default async function PerformanceDiagnosticsPage() {
    await requireAuthentication({
        permission: 'system.logs',
        operation: 'read',
    });

    const thirtyDaysAgo = Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: 30 });

    const [ reportingEnabled, recentVitals, distinctRoutes ] = await Promise.all([
        readSetting('web-vitals-reporting'),
        db.selectFrom(tWebVitals)
            .where(tWebVitals.vitalDate.greaterOrEqual(thirtyDaysAgo))
            .select({
                route: tWebVitals.vitalRoute,
                metric: tWebVitals.vitalMetric,
                value: tWebVitals.vitalValue,
            })
            .executeSelectMany(),
        db.selectDistinctFrom(tWebVitals)
            .selectOneColumn(tWebVitals.vitalRoute)
            .orderBy(tWebVitals.vitalRoute, 'asc')
            .executeSelectMany(),
    ]);

    const summaries = summarizeRouteVitals(recentVitals);

    return (
        <>
            <Section icon={ <SpeedIcon color="primary" /> } title="Performance"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'Performance' },
                     ]}>
                <SectionIntroduction>
                    Real-user Core Web Vitals (TTFB, FCP, LCP, INP, and CLS) collected across the
                    portal, grouped by normalized route and build hash.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <WebVitalsDashboard action={fetchRouteVitals}
                                    reportingEnabled={!!reportingEnabled}
                                    routes={distinctRoutes}
                                    summaries={summaries} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Performance', 'Diagnostics', 'System');
