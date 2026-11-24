// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

import type { WebVitalDeviceType, WebVitalMetric, WebVitalNavigationType } from '@lib/database/Types';

import { kWebVitalDeviceType, kWebVitalMetric, kWebVitalNavigationType } from '@lib/database/Types';

/**
 * Delay, in milliseconds, after the first buffered metric before flushing a coalesced batch.
 */
const kFlushDelayMs = 5_000;

/**
 * Maximum number of metrics per beacon payload (matches `POST /api/vitals`).
 */
const kMaxBatchSize = 50;

/**
 * Breakpoint query matching the portal's `md` (840px) threshold for desktop vs. mobile devices.
 */
const kMobileMediaQuery = '(max-width: 839.95px)';

/**
 * Valid metric names accepted by `POST /api/vitals`.
 */
const kValidMetrics = new Set<string>(Object.values(kWebVitalMetric));

/**
 * Valid navigation types accepted by `POST /api/vitals`.
 */
const kValidNavigationTypes = new Set<string>(Object.values(kWebVitalNavigationType));

/**
 * Queued metric payload awaiting the next beacon flush.
 */
interface QueuedVital {
    metric: WebVitalMetric;
    value: number;
    navigationType: WebVitalNavigationType;
    pathname: string;
}

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];
type WebVitalMetricPayload = Parameters<ReportWebVitalsCallback>[0] & {
    navigationURL?: string;
};

const queuedVitals: QueuedVital[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Resolves the pathname associated with a metric, preferring Next.js's `navigationURL` when
 * available so soft-navigation metrics reported after another route change stay accurate.
 */
function extractPathname(navigationUrl?: string): string {
    if (navigationUrl) {
        try {
            return new URL(navigationUrl, window.location.origin).pathname;
        } catch {
            // Fall back to the current location pathname.
        }
    }

    return window.location.pathname;
}

/**
 * Determines whether the current viewport should be classified as `Mobile` or `Desktop`.
 */
function detectDeviceType(): WebVitalDeviceType {
    if (typeof window.matchMedia === 'function' && window.matchMedia(kMobileMediaQuery).matches)
        return kWebVitalDeviceType.Mobile;

    return kWebVitalDeviceType.Desktop;
}

/**
 * Flushes all currently buffered Web Vitals to `POST /api/vitals` via `navigator.sendBeacon`.
 */
function flushVitals(): void {
    if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
    }

    if (!queuedVitals.length || typeof navigator === 'undefined' || !navigator.sendBeacon)
        return;

    const buildHash = process.env.NEXT_PUBLIC_PROJECT_BUILD_HASH || 'dev';
    const deviceType = detectDeviceType();

    while (queuedVitals.length > 0) {
        const vitals = queuedVitals.splice(0, kMaxBatchSize);
        const body = JSON.stringify({ buildHash, deviceType, vitals });
        navigator.sendBeacon('/api/vitals', new Blob([ body ], { type: 'application/json' }));
    }
}

/**
 * Stable callback passed to `useReportWebVitals`. Buffers metrics in memory and schedules a
 * coalesced flush so initial load metrics (`TTFB`, `FCP`, `LCP`) upload in a single request.
 */
const handleWebVital: ReportWebVitalsCallback = (metric: WebVitalMetricPayload) => {
    if (!kValidMetrics.has(metric.name) || !Number.isFinite(metric.value) || metric.value < 0)
        return;

    const normalizedNavType = metric.navigationType === 'back_forward'
        ? kWebVitalNavigationType.BackForward
        : metric.navigationType;

    if (!kValidNavigationTypes.has(normalizedNavType))
        return;

    queuedVitals.push({
        metric: metric.name as WebVitalMetric,
        value: metric.value,
        navigationType: normalizedNavType as WebVitalNavigationType,
        pathname: extractPathname(metric.navigationURL),
    });

    if (queuedVitals.length >= kMaxBatchSize)
        flushVitals();
    else if (flushTimer === undefined)
        flushTimer = setTimeout(flushVitals, kFlushDelayMs);
};

/**
 * Invisible client component that collects Core Web Vitals via Next.js's `useReportWebVitals` and
 * lazily uploads them in coalesced `navigator.sendBeacon` batches to `/api/vitals`.
 */
export function WebVitalsReporter() {
    useReportWebVitals(handleWebVital);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden')
                flushVitals();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', flushVitals);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', flushVitals);
            flushVitals();
        };
    }, []);

    return null;
}
