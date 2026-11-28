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
 * Precedence order when multiple explicit availability exceptions overlap:
 * `available` < `avoid` < `unavailable`.
 */
const kExceptionPrecedence: Record<EventAvailabilityException['state'], number> = {
    available: 0,
    avoid: 1,
    unavailable: 2,
};

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
 * Optional behaviour switches for `AvailabilityTimeline` compilation.
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
 * Point-in-time and lateral inspection snapshot returned by `AvailabilityTimeline.queryAt()`.
 */
export interface AvailabilityPointSnapshot {
    readonly current?: AvailabilitySegment;
    readonly previous?: AvailabilitySegment;
    readonly next?: AvailabilitySegment;
    readonly availableAgainAtMs?: number;
}

/**
 * Mutable builder used internally by `AvailabilityTimeline` to layer availability rules onto a
 * contiguous segment sequence before coalescing adjacent identical segments.
 */
class AvailabilityTimelineBuilder {
    #segments: AvailabilitySegment[];

    constructor(horizonStartMs: number, horizonEndMs: number) {
        this.#segments = [{
            kind: 'unavailable',
            startMs: horizonStartMs,
            endMs: horizonEndMs,
            reason: 'event-boundary',
        }];
    }

    /**
     * Layer 1: Marks `[boundaryStartMs, boundaryEndMs)` as baseline available.
     */
    applyEventBoundary(boundaryStartMs: number, boundaryEndMs: number): void {
        this.#overlay(boundaryStartMs, boundaryEndMs, (_, startMs, endMs) => ({
            kind: 'available',
            startMs,
            endMs,
            explicit: false,
        }));
    }

    /**
     * Layer 2: Applies the volunteer's daily preferred availability window to currently `available`
     * segments, handling same-day windows, overnight wrap-around, DST transitions, and optional
     * 1-hour edge buffers.
     */
    applyPreferenceWindow(
        horizonStart: Temporal.ZonedDateTime,
        horizonEnd: Temporal.ZonedDateTime,
        timingStart: number,
        timingEnd: number,
        includeBuffer: boolean): void
    {
        if (timingStart === timingEnd)
            return;

        let day = horizonStart.startOfDay();
        const endDay = horizonEnd.startOfDay().add({ days: 1 });

        while (Temporal.ZonedDateTime.compare(day, endDay) < 0) {
            const nextDay = day.add({ days: 1 });
            this.#applyPreferenceWindowForDay(day, nextDay, timingStart, timingEnd, includeBuffer);
            day = nextDay;
        }
    }

    /**
     * Layer 3 (optional): Downgrades `available` intervals overlapping requested program timeslots
     * to `avoid` (`reason: 'requested-event'`).
     */
    applyRequestedTimeslots(timeslots: readonly RequestedProgramTimeslot[]): void {
        for (const timeslot of timeslots) {
            this.#overlay(timeslot.startMs, timeslot.endMs, (existing, startMs, endMs) =>
                existing.kind === 'available'
                    ? {
                        kind: 'avoid',
                        startMs,
                        endMs,
                        reason: 'requested-event',
                        timeslotId: timeslot.id,
                        activityId: timeslot.activityId,
                    }
                    : { ...existing, startMs, endMs });
        }
    }

    /**
     * Layer 4: Applies explicit availability exceptions over layers 1–3 in precedence order.
     */
    applyExceptions(exceptions: readonly EventAvailabilityException[]): void {
        if (!exceptions.length)
            return;

        const orderedExceptions = [ ...exceptions ].sort((lhs, rhs) =>
            kExceptionPrecedence[lhs.state] - kExceptionPrecedence[rhs.state]);

        for (const exception of orderedExceptions) {
            this.#overlay(exception.startMs, exception.endMs, (_, startMs, endMs) => {
                switch (exception.state) {
                    case 'available':
                        return { kind: 'available', startMs, endMs, explicit: true };
                    case 'avoid':
                        return { kind: 'avoid', startMs, endMs, reason: 'exception' };
                    case 'unavailable':
                        return { kind: 'unavailable', startMs, endMs, reason: 'exception' };
                }
            });
        }
    }

    /**
     * Layer 5: Overlays scheduled shift assignments at the highest precedence.
     */
    applyAssignments(assignments: readonly EventShiftAssignment[]): void {
        for (const assignment of assignments) {
            this.#overlay(assignment.startMs, assignment.endMs, (existing, startMs, endMs) =>
                existing.kind === 'shift'
                    ? {
                        kind: 'shift',
                        startMs,
                        endMs,
                        assignments: [ ...existing.assignments, assignment ],
                    }
                    : {
                        kind: 'shift',
                        startMs,
                        endMs,
                        assignments: [ assignment ],
                    });
        }
    }

    /**
     * Coalesces adjacent identical segments and returns the finalized immutable segment list.
     */
    build(): readonly AvailabilitySegment[] {
        if (!this.#segments.length)
            return [];

        const merged: AvailabilitySegment[] = [ this.#segments[0] ];

        for (let index = 1; index < this.#segments.length; ++index) {
            const previous = merged[merged.length - 1];
            const current = this.#segments[index];

            if (this.#canCoalesce(previous, current))
                merged[merged.length - 1] = { ...previous, endMs: current.endMs };
            else
                merged.push(current);
        }

        return merged;
    }

    #applyPreferenceWindowForDay(
        day: Temporal.ZonedDateTime,
        nextDay: Temporal.ZonedDateTime,
        timingStart: number,
        timingEnd: number,
        includeBuffer: boolean): void
    {
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
                this.#markPreferenceUnavailable(dayStartMs, atHour(timingStart - 1));
                this.#markPreferenceBuffer(atHour(timingStart - 1), atHour(timingStart));
                this.#markPreferenceBuffer(atHour(timingEnd), atHour(timingEnd + 1));
                this.#markPreferenceUnavailable(atHour(timingEnd + 1), nextDayStartMs);
            } else {
                this.#markPreferenceUnavailable(dayStartMs, atHour(timingStart));
                this.#markPreferenceUnavailable(atHour(timingEnd), nextDayStartMs);
            }
        } else {
            // Overnight availability window (e.g. 10:00–02:00): unavailable during [end, start).
            if (includeBuffer) {
                this.#markPreferenceBuffer(atHour(timingEnd), atHour(timingEnd + 1));
                this.#markPreferenceUnavailable(atHour(timingEnd + 1), atHour(timingStart - 1));
                this.#markPreferenceBuffer(atHour(timingStart - 1), atHour(timingStart));
            } else {
                this.#markPreferenceUnavailable(atHour(timingEnd), atHour(timingStart));
            }
        }
    }

    #markPreferenceUnavailable(startMs: number, endMs: number): void {
        this.#overlay(startMs, endMs, (existing, s, e) =>
            existing.kind === 'available'
                ? { kind: 'unavailable', startMs: s, endMs: e, reason: 'preference-window' }
                : { ...existing, startMs: s, endMs: e });
    }

    #markPreferenceBuffer(startMs: number, endMs: number): void {
        this.#overlay(startMs, endMs, (existing, s, e) =>
            existing.kind === 'available'
                ? { kind: 'avoid', startMs: s, endMs: e, reason: 'preference-buffer' }
                : { ...existing, startMs: s, endMs: e });
    }

    #overlay(
        overlayStartMs: number,
        overlayEndMs: number,
        buildSegment: (existing: AvailabilitySegment, startMs: number, endMs: number)
            => AvailabilitySegment): void
    {
        if (overlayEndMs <= overlayStartMs)
            return;

        const next: AvailabilitySegment[] = [];

        for (const segment of this.#segments) {
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

        this.#segments = next;
    }

    #canCoalesce(lhs: AvailabilitySegment, rhs: AvailabilitySegment): boolean {
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
}

/**
 * Compiled, immutable sequence of non-overlapping availability segments for a volunteer, applying
 * the five-layer precedence model documented in `app/lib/event/README.md`:
 *
 * 1. Event boundary window (`schedule-event-view-start-hours` / `schedule-event-view-end-hours`)
 * 2. Volunteer daily availability preference window (with optional 1-hour edge buffer)
 * 3. Requested program events (optional, off by default)
 * 4. Explicit availability exceptions (overrides layers 1–3)
 * 5. Scheduled shifts (highest precedence, enabled by default)
 */
export class AvailabilityTimeline {
    static readonly #kEmpty = new AvailabilityTimeline();

    readonly #segments: readonly AvailabilitySegment[];

    /**
     * Returns a shared empty timeline containing no segments.
     */
    static empty(): AvailabilityTimeline {
        return AvailabilityTimeline.#kEmpty;
    }

    /**
     * Parses a raw JSON `availability_exceptions` database column into valid epoch-millisecond
     * exception windows. Invalid or malformed payloads return an empty array without throwing.
     */
    static parseExceptions(raw?: string | null): EventAvailabilityException[] {
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

    constructor(
        input?: AvailabilityTimelineInput,
        options?: AvailabilityTimelineOptions)
    {
        this.#segments = input ? AvailabilityTimeline.#compile(input, options) : [];
    }

    /**
     * All contiguous, non-overlapping segments covering this timeline's horizon.
     */
    get segments(): readonly AvailabilitySegment[] {
        return this.#segments;
    }

    /**
     * Number of segments in this compiled timeline.
     */
    get length(): number {
        return this.#segments.length;
    }

    /**
     * Iterates over compiled availability segments in chronological order.
     */
    *[Symbol.iterator](): IterableIterator<AvailabilitySegment> {
        for (const segment of this.#segments)
            yield segment;
    }

    /**
     * Returns the segment containing `timeMs` (`startMs <= timeMs < endMs`), or `undefined` when
     * `timeMs` falls outside the timeline horizon.
     */
    at(timeMs: number): AvailabilitySegment | undefined {
        const index = this.#findSegmentIndex(timeMs);
        return index >= 0 ? this.#segments[index] : undefined;
    }

    /**
     * Returns the point-in-time and lateral state at `timeMs` (`current`, `previous`, `next`, and
     * `availableAgainAtMs`) in O(log S) using a single binary search.
     */
    queryAt(timeMs: number): AvailabilityPointSnapshot {
        const index = this.#findSegmentIndex(timeMs);

        return {
            current: index >= 0 ? this.#segments[index] : undefined,
            previous: this.#resolvePreviousSegment(index, timeMs),
            next: this.#resolveNextSegment(index, timeMs),
            availableAgainAtMs: this.#findAvailableAgainAtMs(index, timeMs),
        };
    }

    /**
     * Approximate heap footprint in bytes for cache diagnostics reporting.
     */
    estimateByteSize(): number {
        return this.#segments.length * 96;
    }

    #findSegmentIndex(timeMs: number): number {
        let low = 0;
        let high = this.#segments.length - 1;

        while (low <= high) {
            const mid = (low + high) >>> 1;
            const segment = this.#segments[mid];

            if (timeMs < segment.startMs)
                high = mid - 1;
            else if (timeMs >= segment.endMs)
                low = mid + 1;
            else
                return mid;
        }

        return -1;
    }

    #resolvePreviousSegment(index: number, timeMs: number): AvailabilitySegment | undefined {
        if (index > 0)
            return this.#segments[index - 1];
        if (index === -1 && this.#segments.length > 0 &&
            timeMs >= this.#segments[this.#segments.length - 1].endMs)
        {
            return this.#segments[this.#segments.length - 1];
        }

        return undefined;
    }

    #resolveNextSegment(index: number, timeMs: number): AvailabilitySegment | undefined {
        if (index >= 0 && index + 1 < this.#segments.length)
            return this.#segments[index + 1];
        if (index === -1 && this.#segments.length > 0 && timeMs < this.#segments[0].startMs)
            return this.#segments[0];

        return undefined;
    }

    #findAvailableAgainAtMs(index: number, timeMs: number): number | undefined {
        if (!this.#segments.length)
            return undefined;

        let startIndex: number;
        if (index >= 0)
            startIndex = index + 1;
        else if (timeMs < this.#segments[0].startMs)
            startIndex = 0;
        else
            return undefined;

        for (let i = startIndex; i < this.#segments.length; ++i) {
            if (this.#segments[i].kind !== 'unavailable')
                return this.#segments[i].startMs;
        }

        return undefined;
    }

    static #compile(
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

        const horizon = AvailabilityTimeline.#computeHorizon(
            eventStart, eventEnd, boundaryStartMs, boundaryEndMs, exceptions, assignments);

        const builder = new AvailabilityTimelineBuilder(horizon.startMs, horizon.endMs);
        builder.applyEventBoundary(boundaryStartMs, boundaryEndMs);

        const { preferenceTimingStart, preferenceTimingEnd } = input.availability;
        if (preferenceTimingStart !== undefined && preferenceTimingEnd !== undefined) {
            const horizonStart = Temporal.Instant.fromEpochMilliseconds(horizon.startMs)
                .toZonedDateTimeISO(input.event.timeZone);
            const horizonEnd = Temporal.Instant.fromEpochMilliseconds(horizon.endMs)
                .toZonedDateTimeISO(input.event.timeZone);

            builder.applyPreferenceWindow(
                horizonStart, horizonEnd, preferenceTimingStart, preferenceTimingEnd,
                includePreferenceBuffer);
        }

        if (includeRequestedEvents && input.availability.requestedTimeslots?.length)
            builder.applyRequestedTimeslots(input.availability.requestedTimeslots);

        builder.applyExceptions(exceptions);
        builder.applyAssignments(assignments);

        return builder.build();
    }

    static #computeHorizon(
        eventStart: Temporal.ZonedDateTime,
        eventEnd: Temporal.ZonedDateTime,
        boundaryStartMs: number,
        boundaryEndMs: number,
        exceptions: readonly EventAvailabilityException[],
        assignments: readonly EventShiftAssignment[]): TimeInterval
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
}

/**
 * Parses a raw JSON `availability_exceptions` database column into valid epoch-millisecond
 * exception windows.
 */
export function parseAvailabilityExceptions(raw?: string | null): EventAvailabilityException[] {
    return AvailabilityTimeline.parseExceptions(raw);
}

/**
 * Compiles a volunteer's contiguous, non-overlapping availability timeline.
 */
export function computeAvailabilityTimeline(
    input: AvailabilityTimelineInput,
    options?: AvailabilityTimelineOptions): readonly AvailabilitySegment[]
{
    return new AvailabilityTimeline(input, options).segments;
}
