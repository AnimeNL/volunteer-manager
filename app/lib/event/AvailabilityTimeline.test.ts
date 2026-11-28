// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventShiftAssignment } from './Types';
import { AvailabilityTimeline } from './AvailabilityTimeline';

const kTimeZone = 'Europe/Amsterdam';

function zdt(iso: string): Temporal.ZonedDateTime {
    return Temporal.ZonedDateTime.from(`${iso}[${kTimeZone}]`);
}

function ms(iso: string): number {
    return zdt(iso).epochMilliseconds;
}

const kEvent = {
    startTime: zdt('2026-06-12T12:00:00+02:00'),
    endTime: zdt('2026-06-14T18:00:00+02:00'),
    timeZone: kTimeZone,
};

describe('AvailabilityTimeline', () => {
    it('applies event boundary hours around festival start and end', () => {
        const timeline = new AvailabilityTimeline({
            event: kEvent,
            boundaryHours: { beforeStart: 4, afterEnd: 2 },
            availability: {},
        });

        expect(timeline.at(ms('2026-06-12T07:59:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'event-boundary',
        });
        expect(timeline.at(ms('2026-06-12T08:00:00+02:00'))).toMatchObject({
            kind: 'available',
            explicit: false,
        });
        expect(timeline.at(ms('2026-06-14T19:59:00+02:00'))).toMatchObject({
            kind: 'available',
            explicit: false,
        });
        expect(timeline.at(ms('2026-06-14T20:00:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'event-boundary',
        });
    });

    it('applies same-day and overnight daily availability windows cleanly', () => {
        const sameDay = new AvailabilityTimeline({
            event: kEvent,
            boundaryHours: { beforeStart: 4, afterEnd: 2 },
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
            },
        });

        expect(sameDay.at(ms('2026-06-12T09:00:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });
        expect(sameDay.at(ms('2026-06-12T10:00:00+02:00'))).toMatchObject({
            kind: 'available',
        });
        expect(sameDay.at(ms('2026-06-12T22:00:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });

        const overnight = new AvailabilityTimeline({
            event: kEvent,
            boundaryHours: { beforeStart: 4, afterEnd: 2 },
            availability: {
                preferenceTimingStart: 12,
                preferenceTimingEnd: 2,
            },
        });

        expect(overnight.at(ms('2026-06-13T01:30:00+02:00'))).toMatchObject({
            kind: 'available',
        });
        expect(overnight.at(ms('2026-06-13T02:00:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });
        expect(overnight.at(ms('2026-06-13T11:59:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });
        expect(overnight.at(ms('2026-06-13T12:00:00+02:00'))).toMatchObject({
            kind: 'available',
        });
    });

    it('supports optional 1-hour preference edge buffers', () => {
        const timeline = new AvailabilityTimeline({
            event: kEvent,
            boundaryHours: { beforeStart: 4, afterEnd: 2 },
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
            },
        }, { includePreferenceBuffer: true });

        expect(timeline.at(ms('2026-06-13T08:30:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });
        expect(timeline.at(ms('2026-06-13T09:30:00+02:00'))).toMatchObject({
            kind: 'avoid',
            reason: 'preference-buffer',
        });
        expect(timeline.at(ms('2026-06-13T22:30:00+02:00'))).toMatchObject({
            kind: 'avoid',
            reason: 'preference-buffer',
        });
        expect(timeline.at(ms('2026-06-13T23:30:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });
    });

    it('only includes requested program events when opted in and never upgrades unavailable', () => {
        const input = {
            event: kEvent,
            boundaryHours: { beforeStart: 4, afterEnd: 2 },
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
                requestedTimeslots: [
                    {
                        id: 42,
                        activityId: 99,
                        startMs: ms('2026-06-13T14:00:00+02:00'),
                        endMs: ms('2026-06-13T16:00:00+02:00'),
                    },
                    {
                        id: 43,
                        activityId: 100,
                        startMs: ms('2026-06-13T21:00:00+02:00'),
                        endMs: ms('2026-06-13T23:30:00+02:00'),
                    },
                ],
            },
        };

        const defaultTimeline = new AvailabilityTimeline(input);
        expect(defaultTimeline.at(ms('2026-06-13T14:30:00+02:00'))).toMatchObject({
            kind: 'available',
        });

        const withRequested = new AvailabilityTimeline(input, { includeRequestedEvents: true });
        expect(withRequested.at(ms('2026-06-13T14:30:00+02:00'))).toMatchObject({
            kind: 'avoid',
            reason: 'requested-event',
            timeslotId: 42,
            activityId: 99,
        });
        // Partially overlaps unavailable after 22:00 — stays unavailable after 22:00.
        expect(withRequested.at(ms('2026-06-13T21:30:00+02:00'))).toMatchObject({
            kind: 'avoid',
            reason: 'requested-event',
            timeslotId: 43,
        });
        expect(withRequested.at(ms('2026-06-13T22:30:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'preference-window',
        });
    });

    it('lets explicit availability exceptions override event boundaries and preference windows', () => {
        const timeline = new AvailabilityTimeline({
            event: kEvent,
            boundaryHours: { beforeStart: 2, afterEnd: 0 },
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
                exceptions: [
                    // Explicit available before event boundary (e.g. build-up).
                    {
                        startMs: ms('2026-06-12T06:00:00+02:00'),
                        endMs: ms('2026-06-12T09:00:00+02:00'),
                        state: 'available',
                    },
                    // Temporary unavailability mid-day.
                    {
                        startMs: ms('2026-06-13T13:00:00+02:00'),
                        endMs: ms('2026-06-13T14:30:00+02:00'),
                        state: 'unavailable',
                    },
                    // Explicit avoid window.
                    {
                        startMs: ms('2026-06-13T17:00:00+02:00'),
                        endMs: ms('2026-06-13T18:00:00+02:00'),
                        state: 'avoid',
                    },
                ],
            },
        });

        expect(timeline.at(ms('2026-06-12T07:00:00+02:00'))).toMatchObject({
            kind: 'available',
            explicit: true,
        });
        expect(timeline.at(ms('2026-06-13T13:30:00+02:00'))).toMatchObject({
            kind: 'unavailable',
            reason: 'exception',
            endMs: ms('2026-06-13T14:30:00+02:00'),
        });
        expect(timeline.at(ms('2026-06-13T17:30:00+02:00'))).toMatchObject({
            kind: 'avoid',
            reason: 'exception',
        });
    });

    it('gives scheduled shifts top precedence and supports lateral point-in-time queries', () => {
        const entranceShift: EventShiftAssignment = {
            id: 501,
            shiftId: 10,
            userId: 7,
            teamId: 1,
            startMs: ms('2026-06-13T14:00:00+02:00'),
            endMs: ms('2026-06-13T16:00:00+02:00'),
        };

        const timeline = new AvailabilityTimeline({
            event: kEvent,
            boundaryHours: { beforeStart: 2, afterEnd: 0 },
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
                exceptions: [
                    // Unavailable immediately after the shift ends.
                    {
                        startMs: ms('2026-06-13T16:00:00+02:00'),
                        endMs: ms('2026-06-13T18:00:00+02:00'),
                        state: 'unavailable',
                    },
                ],
            },
            assignments: [ entranceShift ],
        });

        const duringShift = timeline.queryAt(ms('2026-06-13T14:50:00+02:00'));
        expect(duringShift.current).toMatchObject({
            kind: 'shift',
            startMs: entranceShift.startMs,
            endMs: entranceShift.endMs,
        });
        expect(duringShift.previous).toMatchObject({
            kind: 'available',
            endMs: entranceShift.startMs,
        });
        expect(duringShift.next).toMatchObject({
            kind: 'unavailable',
            reason: 'exception',
            startMs: ms('2026-06-13T16:00:00+02:00'),
            endMs: ms('2026-06-13T18:00:00+02:00'),
        });

        const duringBreak = timeline.queryAt(ms('2026-06-13T16:30:00+02:00'));
        expect(duringBreak.current).toMatchObject({
            kind: 'unavailable',
            reason: 'exception',
        });
        expect(duringBreak.next).toMatchObject({
            kind: 'available',
            startMs: ms('2026-06-13T18:00:00+02:00'),
        });
        expect(duringBreak.availableAgainAtMs).toBe(ms('2026-06-13T18:00:00+02:00'));

        expect([ ...timeline ]).toEqual(timeline.segments);
        expect(timeline.length).toBe(timeline.segments.length);
        expect(timeline.estimateByteSize()).toBeGreaterThan(0);
    });

    it('supports empty timelines and out-of-horizon queries', () => {
        const empty = AvailabilityTimeline.empty();
        expect(empty.length).toBe(0);
        expect(empty.at(ms('2026-06-13T12:00:00+02:00'))).toBeUndefined();
        expect(empty.queryAt(ms('2026-06-13T12:00:00+02:00'))).toEqual({
            current: undefined,
            previous: undefined,
            next: undefined,
            availableAgainAtMs: undefined,
        });
    });

    it('parses raw availability exception JSON defensively', () => {
        const raw = JSON.stringify([
            {
                start: '2026-06-13T12:00:00Z',
                end: '2026-06-13T14:00:00Z',
                state: 'unavailable',
            },
            {
                start: '2026-06-13T16:00:00Z',
                end: '2026-06-13T15:00:00Z',  // inverted -> ignored
                state: 'available',
            },
        ]);

        const parsed = AvailabilityTimeline.parseExceptions(raw);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].state).toBe('unavailable');

        expect(AvailabilityTimeline.parseExceptions(undefined)).toEqual([]);
        expect(AvailabilityTimeline.parseExceptions('[]')).toEqual([]);
    });
});
