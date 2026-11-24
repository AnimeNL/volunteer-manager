// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { WebVitalMetric } from '@lib/database/Types';

/**
 * Minimal Web Vitals row needed for percentile summary aggregation.
 */
export interface VitalSummaryInput {
    route: string;
    metric: WebVitalMetric;
    value: number;
}

/**
 * Aggregated p75 metrics for a single normalized route.
 */
export interface RouteVitalsSummary {
    route: string;
    samples: number;
    ttfbP75: number | null;
    fcpP75: number | null;
    lcpP75: number | null;
    inpP75: number | null;
    clsP75: number | null;
}

/**
 * Computes the given percentile (0..100) for a non-empty array of numeric values.
 */
export function computePercentile(values: number[], percentile: number): number | null {
    if (!values.length)
        return null;

    const sorted = [ ...values ].sort((lhs, rhs) => lhs - rhs);
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
    );

    return sorted[index];
}

/**
 * Aggregates raw Web Vitals rows into per-route p75 summaries sorted by slowest LCP p75 first.
 */
export function summarizeRouteVitals(rows: VitalSummaryInput[]): RouteVitalsSummary[] {
    const byRoute = new Map<string, Record<WebVitalMetric, number[]>>();

    for (const row of rows) {
        let bucket = byRoute.get(row.route);
        if (!bucket) {
            bucket = { TTFB: [], FCP: [], LCP: [], INP: [], CLS: [] };
            byRoute.set(row.route, bucket);
        }

        bucket[row.metric].push(row.value);
    }

    const summaries: RouteVitalsSummary[] = [];
    for (const [ route, bucket ] of byRoute.entries()) {
        const samples =
            bucket.TTFB.length + bucket.FCP.length + bucket.LCP.length +
            bucket.INP.length + bucket.CLS.length;

        summaries.push({
            route,
            samples,
            ttfbP75: computePercentile(bucket.TTFB, 75),
            fcpP75: computePercentile(bucket.FCP, 75),
            lcpP75: computePercentile(bucket.LCP, 75),
            inpP75: computePercentile(bucket.INP, 75),
            clsP75: computePercentile(bucket.CLS, 75),
        });
    }

    return summaries.sort((lhs, rhs) => (rhs.lcpP75 ?? -1) - (lhs.lcpP75 ?? -1));
}
