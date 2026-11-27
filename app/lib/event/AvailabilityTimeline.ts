// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { AvailabilitySegment, EventAvailabilityException, EventShiftAssignment,
    TimeInterval } from './Types';
import { kTemporalZonedDateTime } from '@lib/ZodHelpers';

/**
 * Default number of hours before the event's start time during which volunteers may be scheduled.
 */
export const kDefaultEventBoundaryStartHours = 4;

/**
 * Default number of hours after the event's end time during which volunteers may be scheduled.
 */
export const kDefaultEventBoundaryEndHours = 4;

/**
 * Zod schema validating an individual availability exception stored in the database.
 */
export const kAvailabilityException = z.object({
    /**
     * Date and time on which the exception starts, in ISO 8601 format in UTC.
     */
    start: kTemporalZonedDateTime,

    /**
     * Date and time on which the exception ends, in ISO 8601 format in UTC.
     */
    end: kTemporalZonedDateTime,

    /**
     * State of the volunteer's availability during that period of time.
     */
    state: z.enum([ 'available', 'avoid', 'unavailable' ]),
});

/**
 * Requested program timeslot that a volunteer prefers to attend rather than work during.
 */
export interface RequestedProgramTimeslot extends TimeInterval {
    readonly id: number;
    readonly activityId?: number;
}

/**
 * Input required to compile a volunteer's layered availability timeline.
 */
export interface AvailabilityTimelineInput {
    readonly event: {
        readonly startTime: Temporal.ZonedDateTime;
        readonly endTime: Temporal.ZonedDateTime;
        readonly timeZone: string;
    };
    readonly boundaryHours?: {
        readonly beforeStart?: number;
        readonly afterEnd?: number;
    };
    readonly availability: {
        readonly preferenceTimingStart?: number;
        readonly preferenceTimingEnd?: number;
        readonly exceptions?: readonly EventAvailabilityException[];
        readonly requestedTimeslots?: readonly RequestedProgramTimeslot[];
    };
    readonly assignments?: readonly EventShiftAssignment[];
}

/**
 * Optional behaviour switches for `computeAvailabilityTimeline()`.
 */
export interface AvailabilityTimelineOptions {
    /**
     * When enabled, downgrades `available` intervals overlapping the volunteer's requested program
     * timeslots to `avoid` (`reason: 'requested-event'`). Defaults to `false`.
     */
    readonly includeRequestedEvents?: boolean;

    /**
     * When enabled, applies a 1-hour `avoid` grace buffer around daily preference window edges.
     * Defaults to `false`.
     */
    readonly includePreferenceBuffer?: boolean;

    /**
     * When enabled, overlays scheduled shifts at the highest precedence. Defaults to `true`.
     */
    readonly includeShifts?: boolean;
}

/**
 * Parses a raw JSON `availability_exceptions` database column into valid epoch-millisecond
 * exception windows. Invalid or malformed payloads return an empty array without throwing.
 */
export function parseAvailabilityExceptions(raw?: string | null): EventAvailabilityException[] {
    if (!raw || raw.length <= 2)
        return [];

    try {
        const parsed = z.array(kAvailabilityException).parse(JSON.parse(raw));
        const exceptions: EventAvailabilityException[] = [];

        for (const entry of parsed) {
            const startMs = entry.start.epochMilliseconds;
            const endMs = entry.end.epochMilliseconds;
            if (endMs > startMs)
                exceptions.push({ startMs, endMs, state: entry.state });
        }

        return exceptions;
    } catch (error) {
        console.warn('Invalid availability exceptions seen:', error);
        return [];
    }
}

/**
 * Overlays `[overlayStartMs, overlayEndMs)` onto a contiguous, non-overlapping segment list,
 * splitting affected segments cleanly at the overlay boundaries.
 */
function overlayInterval(
    segments: readonly AvailabilitySegment[],
    overlayStartMs: number,
    overlayEndMs: number,
    buildSegment: (existing: AvailabilitySegment, startMs: number, endMs: number)
        => AvailabilitySegment): AvailabilitySegment[]
{
    if (overlayEndMs <= overlayStartMs)
        return [ ...segments ];

    const next: AvailabilitySegment[] = [];

    for (const segment of segments) {
        if (segment.endMs <= overlayStartMs || segment.startMs >= overlayEndMs) {
            next.push(segment);
            continue;
        }

        if (segment.startMs < overlayStartMs)
            next.push({ ...segment, endMs: overlayStartMs });

        const overlapStart = Math.max(segment.startMs, overlayStartMs);
        const overlapEnd = Math.min(segment.endMs, overlayEndMs);
        next.push(buildSegment(segment, overlapStart, overlapEnd));

        if (segment.endMs > overlayEndMs)
            next.push({ ...segment, startMs: overlayEndMs });
    }

    return next;
}

/**
 * Returns whether two adjacent segments carry identical semantics and can be coalesced.
 */
function canCoalesce(lhs: AvailabilitySegment, rhs: AvailabilitySegment): boolean {
    if (lhs.endMs !== rhs.startMs || lhs.kind !== rhs.kind)
        return false;

    switch (lhs.kind) {
        case 'available':
            return rhs.kind === 'available' && lhs.explicit === rhs.explicit;

        case 'unavailable':
            return rhs.kind === 'unavailable' && lhs.reason === rhs.reason;

        case 'avoid':
            return rhs.kind === 'avoid' &&
                lhs.reason === rhs.reason &&
                lhs.timeslotId === rhs.timeslotId &&
                lhs.activityId === rhs.activityId;

        case 'shift':
            return false;
    }
}

/**
 * Coalesces adjacent identical segments in-place into a compact timeline.
 */
function coalesceSegments(segments: readonly AvailabilitySegment[]): AvailabilitySegment[] {
    if (!segments.length)
        return [];

    const merged: AvailabilitySegment[] = [ segments[0] ];

    for (let index = 1; index < segments.length; ++index) {
        const previous = merged[merged.length - 1];
        const current = segments[index];

        if (canCoalesce(previous, current))
            merged[merged.length - 1] = { ...previous, endMs: current.endMs };
        else
            merged.push(current);
    }

    return merged;
}

/**
 * Computes the overall `[horizonStartMs, horizonEndMs)` covering all full local event days plus
 * any exceptions or scheduled shifts extending beyond them.
 */
function computeHorizon(
    eventStart: Temporal.ZonedDateTime,
    eventEnd: Temporal.ZonedDateTime,
    boundaryStartMs: number,
    boundaryEndMs: number,
    exceptions: readonly EventAvailabilityException[],
    assignments: readonly EventShiftAssignment[]): { startMs: number; endMs: number }
{
    let startMs = Math.min(
        eventStart.startOfDay().epochMilliseconds,
        boundaryStartMs);
    let endMs = Math.max(
        eventEnd.startOfDay().add({ days: 1 }).epochMilliseconds,
        boundaryEndMs);

    for (const exception of exceptions) {
        if (exception.startMs < startMs)
            startMs = exception.startMs;
        if (exception.endMs > endMs)
            endMs = exception.endMs;
    }

    for (const assignment of assignments) {
        if (assignment.startMs < startMs)
            startMs = assignment.startMs;
        if (assignment.endMs > endMs)
            endMs = assignment.endMs;
    }

    return { startMs, endMs };
}

/**
 * Applies Layer 2 (the volunteer's daily preferred availability window) to currently `available`
 * segments, handling same-day windows, overnight wrap-around, DST transitions, and optional 1-hour
 * edge buffers.
 */
function applyPreferenceWindow(
    segments: AvailabilitySegment[],
    horizonStart: Temporal.ZonedDateTime,
    horizonEnd: Temporal.ZonedDateTime,
    timingStart: number,
    timingEnd: number,
    includeBuffer: boolean): AvailabilitySegment[]
{
    if (timingStart === timingEnd)
        return segments;

    let result = segments;
    let day = horizonStart.startOfDay();
    const endDay = horizonEnd.startOfDay().add({ days: 1 });

    const markUnavailable = (startMs: number, endMs: number) => {
        result = overlayInterval(result, startMs, endMs, (existing, s, e) =>
            existing.kind === 'available'
                ? { kind: 'unavailable', startMs: s, endMs: e, reason: 'preference-window' }
                : { ...existing, startMs: s, endMs: e });
    };

    const markBuffer = (startMs: number, endMs: number) => {
        result = overlayInterval(result, startMs, endMs, (existing, s, e) =>
            existing.kind === 'available'
                ? { kind: 'avoid', startMs: s, endMs: e, reason: 'preference-buffer' }
                : { ...existing, startMs: s, endMs: e });
    };

    while (Temporal.ZonedDateTime.compare(day, endDay) < 0) {
        const nextDay = day.add({ days: 1 });
        const dayStartMs = day.epochMilliseconds;
        const nextDayStartMs = nextDay.epochMilliseconds;

        const atHour = (hour: number) => {
            if (hour <= 0)
                return dayStartMs;
            if (hour >= 24)
                return nextDayStartMs;

            return day.with({ hour, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
        };

        if (timingEnd > timingStart) {
            // Same-day availability window (e.g. 09:00–21:00).
            if (includeBuffer) {
                markUnavailable(dayStartMs, atHour(timingStart - 1));
                markBuffer(atHour(timingStart - 1), atHour(timingStart));
                markBuffer(atHour(timingEnd), atHour(timingEnd + 1));
                markUnavailable(atHour(timingEnd + 1), nextDayStartMs);
            } else {
                markUnavailable(dayStartMs, atHour(timingStart));
                markUnavailable(atHour(timingEnd), nextDayStartMs);
            }
        } else {
            // Overnight availability window (e.g. 10:00–02:00): unavailable during [end, start).
            if (includeBuffer) {
                markBuffer(atHour(timingEnd), atHour(timingEnd + 1));
                markUnavailable(atHour(timingEnd + 1), atHour(timingStart - 1));
                markBuffer(atHour(timingStart - 1), atHour(timingStart));
            } else {
                markUnavailable(atHour(timingEnd), atHour(timingStart));
            }
        }

        day = nextDay;
    }

    return result;
}

/**
 * Precedence order when multiple explicit availability exceptions overlap:
 * `available` < `avoid` < `unavailable`.
 */
const kExceptionPrecedence: Record<EventAvailabilityException['state'], number> = {
    available: 0,
    avoid: 1,
    unavailable: 2,
};

/**
 * Compiles a volunteer's contiguous, non-overlapping availability timeline using the five-layer
 * precedence model documented in `app/lib/event/README.md`:
 *
 * 1. Event boundary window (`schedule-event-view-start-hours` / `schedule-event-view-end-hours`)
 * 2. Volunteer daily availability preference window (with optional 1-hour edge buffer)
 * 3. Requested program events (optional, off by default)
 * 4. Explicit availability exceptions (overrides layers 1–3)
 * 5. Scheduled shifts (highest precedence, enabled by default)
 */
export function computeAvailabilityTimeline(
    input: AvailabilityTimelineInput,
    options?: AvailabilityTimelineOptions): readonly AvailabilitySegment[]
{
    const includeRequestedEvents = options?.includeRequestedEvents ?? false;
    const includePreferenceBuffer = options?.includePreferenceBuffer ?? false;
    const includeShifts = options?.includeShifts ?? true;

    const eventStart = input.event.startTime.withTimeZone(input.event.timeZone);
    const eventEnd = input.event.endTime.withTimeZone(input.event.timeZone);

    const beforeHours = input.boundaryHours?.beforeStart ?? kDefaultEventBoundaryStartHours;
    const afterHours = input.boundaryHours?.afterEnd ?? kDefaultEventBoundaryEndHours;

    const boundaryStartMs = eventStart.subtract({ hours: beforeHours }).epochMilliseconds;
    const boundaryEndMs = eventEnd.add({ hours: afterHours }).epochMilliseconds;

    const exceptions = input.availability.exceptions ?? [];
    const assignments = includeShifts ? (input.assignments ?? []) : [];

    const horizon = computeHorizon(
        eventStart, eventEnd, boundaryStartMs, boundaryEndMs, exceptions, assignments);

    // Layer 1: Event boundary window.
    let segments: AvailabilitySegment[] = [{
        kind: 'unavailable',
        startMs: horizon.startMs,
        endMs: horizon.endMs,
        reason: 'event-boundary',
    }];

    segments = overlayInterval(segments, boundaryStartMs, boundaryEndMs, (_, s, e) => ({
        kind: 'available',
        startMs: s,
        endMs: e,
        explicit: false,
    }));

    // Layer 2: Volunteer's daily availability preference window.
    const { preferenceTimingStart, preferenceTimingEnd } = input.availability;
    if (preferenceTimingStart !== undefined && preferenceTimingEnd !== undefined) {
        const horizonStart = Temporal.Instant.fromEpochMilliseconds(horizon.startMs)
            .toZonedDateTimeISO(input.event.timeZone);
        const horizonEnd = Temporal.Instant.fromEpochMilliseconds(horizon.endMs)
            .toZonedDateTimeISO(input.event.timeZone);

        segments = applyPreferenceWindow(
            segments, horizonStart, horizonEnd, preferenceTimingStart, preferenceTimingEnd,
            includePreferenceBuffer);
    }

    // Layer 3 (optional): Volunteer's requested program events downgrade `available` to `avoid`.
    if (includeRequestedEvents && input.availability.requestedTimeslots?.length) {
        for (const timeslot of input.availability.requestedTimeslots) {
            segments = overlayInterval(segments, timeslot.startMs, timeslot.endMs,
                (existing, s, e) => existing.kind === 'available'
                    ? {
                        kind: 'avoid',
                        startMs: s,
                        endMs: e,
                        reason: 'requested-event',
                        timeslotId: timeslot.id,
                        activityId: timeslot.activityId,
                    }
                    : { ...existing, startMs: s, endMs: e });
        }
    }

    // Layer 4: Explicit availability exceptions override layers 1–3.
    if (exceptions.length) {
        const orderedExceptions = [ ...exceptions ].sort((lhs, rhs) =>
            kExceptionPrecedence[lhs.state] - kExceptionPrecedence[rhs.state]);

        for (const exception of orderedExceptions) {
            segments = overlayInterval(segments, exception.startMs, exception.endMs, (_, s, e) => {
                switch (exception.state) {
                    case 'available':
                        return { kind: 'available', startMs: s, endMs: e, explicit: true };
                    case 'avoid':
                        return { kind: 'avoid', startMs: s, endMs: e, reason: 'exception' };
                    case 'unavailable':
                        return { kind: 'unavailable', startMs: s, endMs: e, reason: 'exception' };
                }
            });
        }
    }

    // Layer 5: Scheduled shifts take top precedence over availability.
    if (assignments.length) {
        for (const assignment of assignments) {
            segments = overlayInterval(segments, assignment.startMs, assignment.endMs,
                (existing, s, e) => existing.kind === 'shift'
                    ? {
                        kind: 'shift',
                        startMs: s,
                        endMs: e,
                        assignments: [ ...existing.assignments, assignment ],
                    }
                    : {
                        kind: 'shift',
                        startMs: s,
                        endMs: e,
                        assignments: [ assignment ],
                    });
        }
    }

    return coalesceSegments(segments);
}

/**
 * Binary-searches a compiled `timeline` for the index of the segment containing `timeMs`
 * (`startMs <= timeMs < endMs`). Returns `-1` when `timeMs` falls outside the timeline horizon.
 */
export function findAvailabilitySegmentIndex(
    timeline: readonly AvailabilitySegment[],
    timeMs: number): number
{
    let low = 0;
    let high = timeline.length - 1;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        const segment = timeline[mid];

        if (timeMs < segment.startMs)
            high = mid - 1;
        else if (timeMs >= segment.endMs)
            low = mid + 1;
        else
            return mid;
    }

    return -1;
}
