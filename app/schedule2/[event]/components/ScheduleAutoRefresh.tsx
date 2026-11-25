// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { startTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { kDefaultCheckInRateSeconds, kMaxCheckInRateSeconds,
    kMinCheckInRateSeconds } from '../Constants';

/**
 * Clamps `intervalSeconds` to the supported `[kMinCheckInRateSeconds, kMaxCheckInRateSeconds]`
 * range, falling back to `kDefaultCheckInRateSeconds` when the configured value is not finite.
 */
function clampIntervalSeconds(intervalSeconds: number): number {
    if (!Number.isFinite(intervalSeconds))
        return kDefaultCheckInRateSeconds;

    return Math.min(Math.max(intervalSeconds, kMinCheckInRateSeconds), kMaxCheckInRateSeconds);
}

/**
 * Props accepted by the <ScheduleAutoRefresh> component.
 */
interface ScheduleAutoRefreshProps {
    /**
     * Configured check-in cadence in seconds (`schedule-check-in-rate-seconds`).
     */
    intervalSeconds: number;
}

/**
 * Renderless client leaf that keeps the schedule portal up to date via `router.refresh()`.
 * Refreshes every `intervalSeconds` (clamped to [5, 900]s) while the app has focus, and refreshes
 * on regaining focus at most once every `intervalSeconds / 2` seconds.
 */
export function ScheduleAutoRefresh(props: ScheduleAutoRefreshProps) {
    const router = useRouter();
    const lastRefreshAtRef = useRef<number | null>(null);

    const intervalMs = clampIntervalSeconds(props.intervalSeconds) * 1000;
    const minFocusGapMs = intervalMs / 2;

    useEffect(() => {
        if (lastRefreshAtRef.current === null)
            lastRefreshAtRef.current = Date.now();

        let timerId: ReturnType<typeof setTimeout> | undefined;

        const isActive = () =>
            document.visibilityState === 'visible' && document.hasFocus();

        const clearTimer = () => {
            if (timerId !== undefined) {
                clearTimeout(timerId);
                timerId = undefined;
            }
        };

        const triggerRefresh = () => {
            if (navigator.onLine === false)
                return false;

            lastRefreshAtRef.current = Date.now();
            startTransition(() => {
                router.refresh();
            });
            return true;
        };

        const scheduleNext = (delayMs: number) => {
            clearTimer();
            timerId = setTimeout(() => {
                timerId = undefined;
                if (!isActive())
                    return;

                triggerRefresh();
                scheduleNext(intervalMs);
            }, delayMs);
        };

        const handleActivate = () => {
            if (document.visibilityState !== 'visible')
                return;

            const elapsed = Date.now() - (lastRefreshAtRef.current ?? 0);
            if (elapsed >= minFocusGapMs) {
                triggerRefresh();
                scheduleNext(intervalMs);
            } else if (timerId === undefined) {
                scheduleNext(Math.max(0, intervalMs - elapsed));
            }
        };

        const handleVisibilityChange = () => {
            if (isActive())
                handleActivate();
            else
                clearTimer();
        };

        const handleOnline = () => {
            if (isActive())
                handleActivate();
        };

        if (isActive()) {
            const elapsed = Date.now() - lastRefreshAtRef.current;
            scheduleNext(Math.max(0, intervalMs - elapsed));
        }

        window.addEventListener('focus', handleActivate);
        window.addEventListener('blur', clearTimer);
        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimer();
            window.removeEventListener('focus', handleActivate);
            window.removeEventListener('blur', clearTimer);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [ intervalMs, minFocusGapMs, router ]);

    return null;
}
