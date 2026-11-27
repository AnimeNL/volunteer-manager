// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import {
    kTemporalPlainDate,
    kTemporalPlainDateTime,
    kTemporalPlainTime,
    kTemporalZonedDateTime,
} from './ZodHelpers';

describe('ZodHelpers', () => {
    it('can correctly validate the Temporal.PlainDate type', () => {
        expect(kTemporalPlainDate.parse('2006-08-24').toString()).toEqual('2006-08-24');
        expect(kTemporalPlainDate.parse('20060824').toString()).toEqual('2006-08-24');
        expect(kTemporalPlainDate.parse('2006-08-24T15:43:27').toString())
            .toEqual('2006-08-24');
        expect(kTemporalPlainDate.parse('2006-08-24T15:43:27-09:00[Asia/Tokyo]').toString())
            .toEqual('2006-08-24');

        expect(() => kTemporalPlainDate.parse('June 1st, 2023')).toThrow();
        expect(() => kTemporalPlainDate.parse('Bananaphone')).toThrow();
        expect(() => kTemporalPlainDate.parse('')).toThrow();
    });

    it('can correctly validate the Temporal.PlainDateTime type', () => {
        expect(kTemporalPlainDateTime.parse('2026-06-12T18:30').toString())
            .toEqual('2026-06-12T18:30:00');
        expect(kTemporalPlainDateTime.parse('2026-06-12T18:30:45').toString())
            .toEqual('2026-06-12T18:30:45');
        expect(kTemporalPlainDateTime.parse('2026-06-12T18:30:45+02:00[Europe/Amsterdam]').toString())
            .toEqual('2026-06-12T18:30:45');

        expect(() => kTemporalPlainDateTime.parse('June 1st, 2023')).toThrow();
        expect(() => kTemporalPlainDateTime.parse('18:30:00')).toThrow();
        expect(() => kTemporalPlainDateTime.parse('Bananaphone')).toThrow();
        expect(() => kTemporalPlainDateTime.parse('')).toThrow();
    });

    it('can correctly validate the Temporal.PlainTime type', () => {
        expect(kTemporalPlainTime.parse('03:24:30').toString()).toEqual('03:24:30');
        expect(kTemporalPlainTime.parse('1995-12-07T03:24:30').toString()).toEqual('03:24:30');
        expect(kTemporalPlainTime.parse('1995-12-07T03:24:30-09:00[Asia/Tokyo]').toString())
            .toEqual('03:24:30');

        expect(() => kTemporalPlainTime.parse('Half past midnight')).toThrow();
        expect(() => kTemporalPlainTime.parse('Bananaphone')).toThrow();
        expect(() => kTemporalPlainTime.parse('')).toThrow();
    });

    it('can correctly validate the Temporal.ZonedDateTime type', () => {
        expect(
            kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00[Africa/Cairo]').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00[Africa/Cairo][u-ca=islamic]')
                .toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            kTemporalZonedDateTime.parse('19951207T032430+0200[Africa/Cairo]').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00[+02:00]').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            kTemporalZonedDateTime.parse('1995-12-07T01:24:30Z').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            kTemporalZonedDateTime.parse('1995-12-07T03:24:30+03:00[Africa/Cairo]').toString())
                .toEqual('1995-12-07T00:24:30+00:00[UTC]');

        expect(() => kTemporalZonedDateTime.parse('1995-12-07T03:24:30')).toThrow();
        expect(() => kTemporalZonedDateTime.parse('1995-12-07 03:24:30')).toThrow();
        expect(() => kTemporalZonedDateTime.parse('Half past midnight')).toThrow();
        expect(() => kTemporalZonedDateTime.parse('Bananaphone')).toThrow();
        expect(() => kTemporalZonedDateTime.parse('')).toThrow();
    });
});
