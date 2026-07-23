// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DefaultTypeAdapter, TypeAdapter } from 'ts-sql-query/TypeAdapter';
import { formatDate } from '@lib/Temporal';

/**
 * Regular expressions used to interpret received dates as either dates or times.
 */
const kDateRegExp = /^\d{4}\-\d{2}\-\d{2}$/;
const kDateTimeRegExp = /^\d{4}\-\d{2}\-\d{2} \d{2}:\d{2}:\d{2}$/;
const kTimeRegExp = /^\d{2}:\d{2}:\d{2}$/;

/**
 * Type adapter to translate between DATE, DATETIME, TIME and TIMESTAMP fields in the database, and
 * our canonical date/time representation in TypeScript. All times and dates will be represented in
 * the UTC timezone, unless they're being presented to the user.
 */
export const TemporalTypeAdapter = new class implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        if (![ 'date', 'dateTime', 'time', 'timestamp' ].includes(type))
            return next.transformValueFromDB(value, type);

        if (value === null || value === undefined)
            return value;  // pass-through nullsy values

        if (typeof value !== 'string') {
            throw new Error(
                `Unexpected value received by TemporalTypeAdapter(::fromDB): ${typeof value}`);
        }

        switch (type) {
            case 'date': {
                if (!kDateRegExp.test(value)) {
                    throw new Error(
                        `Unexpected date format received by TemporalTypeAdapter: ${value}`);
                }

                return Temporal.PlainDate.from(value);
            }

            case 'dateTime':
            case 'timestamp': {
                if (!kDateTimeRegExp.test(value)) {
                    throw new Error(
                        `Unexpected date+time format received by TemporalTypeAdapter: ${value}`);
                }

                return Temporal.PlainDateTime.from(value).toZonedDateTime('UTC', {
                    disambiguation: 'earlier',
                });
            }

            case 'time': {
                if (!kTimeRegExp.test(value)) {
                    throw new Error(
                        `Unexpected date+time format received by TemporalTypeAdapter: ${value}`);
                }

                return Temporal.PlainTime.from(value);
            }
        }
    }

    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        if (![ 'date', 'dateTime', 'time', 'timestamp' ].includes(type))
            return next.transformValueToDB(value, type);

        if (value === null || value === undefined)
            return value;  // pass-through nullsy values

        switch (type) {
            case 'date': {
                if (!(value instanceof Temporal.PlainDate)) {
                    throw new Error(
                        `Unexpected value received by TemporalTypeAdapter::toDB: ${typeof value}`);
                }

                return formatDate(value, 'YYYY-MM-DD');
            }

            case 'dateTime':
            case 'timestamp': {
                if (!(value instanceof Temporal.ZonedDateTime)) {
                    throw new Error(
                        `Unexpected value received by TemporalTypeAdapter::toDB: ${typeof value}`);
                }

                return formatDate(value.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss');
            }

            case 'time': {
                if (!(value instanceof Temporal.PlainTime)) {
                    throw new Error(
                        `Unexpected value received by TemporalTypeAdapter::toDB: ${typeof value}`);
                }

                return formatDate(value, 'HH:mm:ss');
            }
        }
    }
}
