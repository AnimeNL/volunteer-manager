// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import * as zt from './Types';

describe('Types', () => {
    it('can correctly validate the Temporal.PlainDate type', () => {
        expect(zt.kTemporalPlainDate.parse('2006-08-24').toString()).toEqual('2006-08-24');
        expect(zt.kTemporalPlainDate.parse('20060824').toString()).toEqual('2006-08-24');
        expect(zt.kTemporalPlainDate.parse('2006-08-24T15:43:27').toString())
            .toEqual('2006-08-24');
        expect(zt.kTemporalPlainDate.parse('2006-08-24T15:43:27-09:00[Asia/Tokyo]').toString())
            .toEqual('2006-08-24');

        expect(() => zt.kTemporalPlainDate.parse('June 1st, 2023')).toThrow();
        expect(() => zt.kTemporalPlainDate.parse('Bananaphone')).toThrow();
        expect(() => zt.kTemporalPlainDate.parse('')).toThrow();
    });

    it('can correctly validate the Temporal.PlainTime type', () => {
        expect(zt.kTemporalPlainTime.parse('03:24:30').toString()).toEqual('03:24:30');
        expect(zt.kTemporalPlainTime.parse('1995-12-07T03:24:30').toString()).toEqual('03:24:30');
        expect(zt.kTemporalPlainTime.parse('1995-12-07T03:24:30-09:00[Asia/Tokyo]').toString())
            .toEqual('03:24:30');

        expect(() => zt.kTemporalPlainTime.parse('Half past midnight')).toThrow();
        expect(() => zt.kTemporalPlainTime.parse('Bananaphone')).toThrow();
        expect(() => zt.kTemporalPlainTime.parse('')).toThrow();
    });

    it('can correctly validate the Temporal.ZonedDateTime type', () => {
        expect(
            zt.kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00[Africa/Cairo]').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            zt.kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00[Africa/Cairo][u-ca=islamic]')
                .toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            zt.kTemporalZonedDateTime.parse('19951207T032430+0200[Africa/Cairo]').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            zt.kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00[+02:00]').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            zt.kTemporalZonedDateTime.parse('1995-12-07T01:24:30Z').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            zt.kTemporalZonedDateTime.parse('1995-12-07T03:24:30+02:00').toString())
                .toEqual('1995-12-07T01:24:30+00:00[UTC]');
        expect(
            zt.kTemporalZonedDateTime.parse('1995-12-07T03:24:30+03:00[Africa/Cairo]').toString())
                .toEqual('1995-12-07T00:24:30+00:00[UTC]');

        expect(() => zt.kTemporalZonedDateTime.parse('1995-12-07T03:24:30')).toThrow();
        expect(() => zt.kTemporalZonedDateTime.parse('1995-12-07 03:24:30')).toThrow();
        expect(() => zt.kTemporalZonedDateTime.parse('Half past midnight')).toThrow();
        expect(() => zt.kTemporalZonedDateTime.parse('Bananaphone')).toThrow();
        expect(() => zt.kTemporalZonedDateTime.parse('')).toThrow();
    });
});
