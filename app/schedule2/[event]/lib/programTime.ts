// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Hour of the morning at which the logical festival day rolls over.
 */
const kLogicalDayChangeHour = 4;

/**
 * Returns the logical festival date for `time`, treating hours before 04:00 as belonging to the
 * previous calendar day.
 */
export function getLogicalDate(time: Temporal.ZonedDateTime): Temporal.PlainDate {
    return time.subtract({ hours: kLogicalDayChangeHour }).toPlainDate();
}

/**
 * Computes display state and progress percentage for a timeslot spanning `startMs` to `endMs` at
 * `nowMs`.
 */
export function getTimeslotTiming(startMs: number, endMs: number, nowMs: number): {
    isActive: boolean;
    isPast: boolean;
    progress: number | undefined;
    state: 'active' | 'default' | 'past';
} {
    const isPast = endMs <= nowMs;
    const isActive = !isPast && startMs <= nowMs;
    const progress = isActive && endMs > startMs
        ? Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)))
        : undefined;
    const state = isPast ? 'past' : (isActive ? 'active' : 'default');

    return { isActive, isPast, progress, state };
}

/**
 * Comparator ordering active and upcoming timeslots before past ones, then by start time, then by
 * end time.
 */
export function compareTimeslots(
    lhs: { endMs: number; isPast: boolean; startMs: number },
    rhs: { endMs: number; isPast: boolean; startMs: number },
): number {
    return Number(lhs.isPast) - Number(rhs.isPast) ||
        lhs.startMs - rhs.startMs ||
        lhs.endMs - rhs.endMs;
}

/**
 * Formats a ticket price given in `cents` as a compact EUR label (e.g. `€20` or `€12.50`).
 */
export function formatEuroPrice(cents: number): string {
    const euros = cents / 100;
    return Number.isInteger(euros) ? `€${euros}` : `€${euros.toFixed(2)}`;
}
