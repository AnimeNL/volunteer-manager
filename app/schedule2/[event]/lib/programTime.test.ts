// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { compareTimeslots, formatTimeRange, getLogicalDate,
    getTimeslotTiming } from './programTime';

describe('programTime', () => {
    describe('getLogicalDate', () => {
        it('treats times before 04:00 as belonging to the previous calendar day', () => {
            const beforeRollover = Temporal.ZonedDateTime.from(
                '2026-06-06T03:59:00+02:00[Europe/Amsterdam]');

            expect(getLogicalDate(beforeRollover).toString()).toEqual('2026-06-05');
        });

        it('treats times at or after 04:00 as belonging to the current calendar day', () => {
            const atRollover = Temporal.ZonedDateTime.from(
                '2026-06-06T04:00:00+02:00[Europe/Amsterdam]');

            expect(getLogicalDate(atRollover).toString()).toEqual('2026-06-06');
        });
    });

    describe('getTimeslotTiming', () => {
        const startMs = 1_000_000;
        const endMs = 1_001_000;

        it('returns default state with no progress for upcoming timeslots', () => {
            expect(getTimeslotTiming(startMs, endMs, startMs - 1)).toEqual({
                isActive: false,
                isPast: false,
                progress: undefined,
                state: 'default',
            });
        });

        it('returns active state and rounded progress for ongoing timeslots', () => {
            expect(getTimeslotTiming(startMs, endMs, startMs)).toEqual({
                isActive: true,
                isPast: false,
                progress: 0,
                state: 'active',
            });

            expect(getTimeslotTiming(startMs, endMs, startMs + 500)).toEqual({
                isActive: true,
                isPast: false,
                progress: 50,
                state: 'active',
            });

            expect(getTimeslotTiming(startMs, endMs, endMs - 1)).toEqual({
                isActive: true,
                isPast: false,
                progress: 100,
                state: 'active',
            });
        });

        it('returns past state with no progress at or after the end time', () => {
            expect(getTimeslotTiming(startMs, endMs, endMs)).toEqual({
                isActive: false,
                isPast: true,
                progress: undefined,
                state: 'past',
            });

            expect(getTimeslotTiming(startMs, endMs, endMs + 500)).toEqual({
                isActive: false,
                isPast: true,
                progress: undefined,
                state: 'past',
            });
        });

        it('handles zero-duration timeslots without producing NaN progress', () => {
            expect(getTimeslotTiming(startMs, startMs, startMs - 1)).toEqual({
                isActive: false,
                isPast: false,
                progress: undefined,
                state: 'default',
            });

            expect(getTimeslotTiming(startMs, startMs, startMs)).toEqual({
                isActive: false,
                isPast: true,
                progress: undefined,
                state: 'past',
            });
        });
    });

    describe('compareTimeslots', () => {
        it('orders active/upcoming timeslots before past ones, then by startMs and endMs', () => {
            const pastEarly = { endMs: 200, isPast: true, startMs: 100 };
            const upcomingLateStart = { endMs: 600, isPast: false, startMs: 500 };
            const upcomingEarlyShort = { endMs: 350, isPast: false, startMs: 300 };
            const upcomingEarlyLong = { endMs: 450, isPast: false, startMs: 300 };

            const sorted = [
                pastEarly,
                upcomingLateStart,
                upcomingEarlyLong,
                upcomingEarlyShort,
            ].sort(compareTimeslots);

            expect(sorted).toEqual([
                upcomingEarlyShort,
                upcomingEarlyLong,
                upcomingLateStart,
                pastEarly,
            ]);
        });
    });

    describe('formatTimeRange', () => {
        it('formats start and end times with an optional weekday prefix', () => {
            const start = Temporal.ZonedDateTime.from(
                '2026-06-06T14:00:00+02:00[Europe/Amsterdam]');
            const end = Temporal.ZonedDateTime.from(
                '2026-06-06T16:30:00+02:00[Europe/Amsterdam]');

            expect(formatTimeRange(start, end)).toEqual('14:00–16:30');
            expect(formatTimeRange(start, end, { includeDay: true })).toEqual('Sat, 14:00–16:30');
        });
    });
});
