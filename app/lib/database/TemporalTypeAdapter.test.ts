// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DefaultTypeAdapter } from 'ts-sql-query/TypeAdapter';

import { TemporalTypeAdapter } from './TemporalTypeAdapter';
import { formatDate } from '@lib/Temporal';

describe('TemporalTypeAdapter', () => {
    const adapter = TemporalTypeAdapter;

    const kNext: DefaultTypeAdapter = {
        transformValueFromDB(value: unknown, type: string): unknown { return null },
        transformValueToDB(value: unknown, type: string): unknown { return null; },
        transformPlaceholder(
            placeholder: string, type: string, forceTypeCast: boolean,
            valueSentToDB: unknown): string { return '' },
    };

    it('should reject type conversions for unrelated types', () => {
        expect(() => adapter.transformValueFromDB('2022-01-01', 'date', kNext)).not.toThrow();
        expect(() => adapter.transformValueFromDB('2022-01-01 00:00:00', 'dateTime', kNext))
            .not.toThrow();

        expect(() => adapter.transformValueFromDB('00:00:00', 'time', kNext)).not.toThrow();
        expect(() => adapter.transformValueFromDB('2022-01-01 00:00:00', 'timestamp', kNext))
            .not.toThrow();

        expect(() => adapter.transformValueFromDB({ /* object */ }, 'dateTime', kNext)).toThrow();
        expect(() => adapter.transformValueFromDB(42.1234, 'dateTime', kNext)).toThrow();
        expect(() => adapter.transformValueFromDB(true, 'dateTime', kNext)).toThrow();
        expect(() => adapter.transformValueFromDB(false, 'dateTime', kNext)).toThrow();
    });

    it('should represent dates as PlainDate objects, separate from any timezone', () => {
        // Database -> TypeScript
        expect(adapter.transformValueFromDB(null, 'date', kNext)).toBeNull();
        expect(adapter.transformValueFromDB(undefined, 'date', kNext)).toBeUndefined();

        const plainDate = adapter.transformValueFromDB('2024-01-03', 'date', kNext);
        expect(plainDate).toBeInstanceOf(Temporal.PlainDate);

        const instance = plainDate as Temporal.PlainDate;
        expect(formatDate(instance, 'YYYY-MM-DD')).toBe('2024-01-03');
        expect(formatDate(instance, 'YYYY-MM-DD[T]HH:mm:ss[Z]')).toBe('2024-01-03T00:00:00Z');

        // TypeScript -> Database
        expect(adapter.transformValueToDB(null, 'date', kNext)).toBeNull();
        expect(adapter.transformValueToDB(undefined, 'date', kNext)).toBeUndefined();

        expect(adapter.transformValueToDB(Temporal.PlainDate.from('1564-04-26'), 'date', kNext))
            .toBe('1564-04-26');
        expect(adapter.transformValueToDB(Temporal.PlainDate.from('2024-02-04'), 'date', kNext))
            .toBe('2024-02-04');
        expect(adapter.transformValueToDB(Temporal.PlainDate.from('2381-10-09'), 'date', kNext))
            .toBe('2381-10-09');
    });

    it('should represent times as PlainTime objects, separate from any timezone', () => {
        // Database -> TypeScript
        expect(adapter.transformValueFromDB(null, 'time', kNext)).toBeNull();
        expect(adapter.transformValueFromDB(undefined, 'time', kNext)).toBeUndefined();

        const plainTime = adapter.transformValueFromDB('12:13:14', 'time', kNext);
        expect(plainTime).toBeInstanceOf(Temporal.PlainTime);

        const instance = plainTime as Temporal.PlainTime;
        expect(formatDate(instance, 'HH:mm:ss')).toBe('12:13:14');
        expect(formatDate(instance, 'YYYY-MM-DD[T]HH:mm:ss[Z]')).toBe('1970-01-01T12:13:14Z');

        // TypeScript -> Database
        expect(adapter.transformValueToDB(null, 'time', kNext)).toBeNull();
        expect(adapter.transformValueToDB(undefined, 'time', kNext)).toBeUndefined();

        expect(adapter.transformValueToDB(Temporal.PlainTime.from('00:00:00'), 'time', kNext))
            .toBe('00:00:00');
        expect(adapter.transformValueToDB(Temporal.PlainTime.from('12:13:14'), 'time', kNext))
            .toBe('12:13:14');
        expect(adapter.transformValueToDB(Temporal.PlainTime.from('23:59:59'), 'time', kNext))
            .toBe('23:59:59');
    });

    it('should always represent times in UTC, regardless of input timezone', () => {
        const transformations = [
            { type: 'dateTime', input: null, output: null },
            { type: 'dateTime', input: undefined, output: undefined },
            {
                type: 'dateTime',
                input: '2024-01-03 23:59:59',
                output: '2024-01-03T23:59:59Z'
            },

            { type: 'timestamp', input: null, output: null },
            { type: 'timestamp', input: undefined, output: undefined },
            {
                type: 'timestamp',
                input: '2024-01-03 23:59:59',
                output: '2024-01-03T23:59:59Z'
            },
        ];

        for (const { type, input, output } of transformations) {
            const actualOutput = adapter.transformValueFromDB(input, type, kNext);
            if (output === null) {
                expect(actualOutput).toBeNull();
            } else if (actualOutput === undefined) {
                expect(actualOutput).toBeUndefined();
            } else {
                expect(actualOutput).toBeInstanceOf(Temporal.ZonedDateTime);

                const actualOutputTemporal = actualOutput as Temporal.ZonedDateTime;
                expect(actualOutputTemporal.timeZoneId).toEqual('UTC');
                expect(formatDate(actualOutputTemporal, 'YYYY-MM-DD[T]HH:mm:ss[Z]')).toBe(output);
            }
        }
    });

    it('should always write values to the database assuming UTC times', () => {
        const transformations = [
            { type: 'dateTime', input: null, output: null },
            { type: 'dateTime', input: undefined, output: undefined },
            {
                type: 'dateTime',
                input: Temporal.ZonedDateTime.from('2024-01-03T23:59:59-05:00[America/New_York]'),
                output: '2024-01-04 04:59:59'
            },
            {
                type: 'dateTime',
                input: Temporal.ZonedDateTime.from('2024-01-03T23:59:59Z[UTC]'),
                output: '2024-01-03 23:59:59'
            },
            {
                type: 'dateTime',
                input: Temporal.ZonedDateTime.from('2024-01-03T00:59:59+09:00[Asia/Tokyo]'),
                output: '2024-01-02 15:59:59'
            },

            { type: 'timestamp', input: null, output: null },
            { type: 'timestamp', input: undefined, output: undefined },
            {
                type: 'timestamp',
                input: Temporal.ZonedDateTime.from('2024-01-03T23:59:59-05:00[America/New_York]'),
                output: '2024-01-04 04:59:59'
            },
            {
                type: 'timestamp',
                input: Temporal.ZonedDateTime.from('2024-01-03T23:59:59Z[UTC]'),
                output: '2024-01-03 23:59:59'
            },
            {
                type: 'timestamp',
                input: Temporal.ZonedDateTime.from('2024-01-03T00:59:59+09:00[Asia/Tokyo]'),
                output: '2024-01-02 15:59:59'
            },
        ];

        for (const { type, input, output } of transformations) {
            const actualOutput = adapter.transformValueToDB(input, type, kNext);
            if (output === null) {
                expect(actualOutput).toBeNull();
            } else if (actualOutput === undefined) {
                expect(actualOutput).toBeUndefined();
            } else {
                expect(actualOutput).toBe(output);
            }
        }
    });
});
