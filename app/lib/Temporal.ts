// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Temporal } from 'temporal-polyfill';
export { Temporal };

/**
 * Type definition of a `ZonedDateTime`, as the `ts-sql-codegen` library insists on the type name
 * and the export name being identical, which is not the case for `Temporal`.
 */
export type ZonedDateTime = Temporal.ZonedDateTime;

/**
 * Export top-level type definitions for the plain date and time types.
 */
export type PlainDate = Temporal.PlainDate;
export type PlainTime = Temporal.PlainTime;

/**
 * Regular expression using which we parse the format passed to the `format` function. It combines
 * the original expression with the one used in the _advancedFormat_ plugin, as we support both.
 *
 * @see https://github.com/iamkun/dayjs/blob/dev/src/constant.js
 * @see https://github.com/iamkun/dayjs/blob/dev/src/plugin/advancedFormat/index.js
 */
const kFormatRegexp =
    /\[([^\]]+)]|Y{1,4}|M{1,4}|Do|D{1,2}|d{1,4}|Wo|W{1,2}|w{1,2}|H{1,2}|h{1,2}|k{1,2}|a|A|m{1,2}|s{1,2}|x|X|Z{1,2}|zzz|z|SSSS|SSS|Q/g;

/**
 * Returns the given `value` as a number witn an ordinal. I.e. "1" -> "1st", "4" -> "4th", etc.
 * @see https://stackoverflow.com/a/31615643
 */
function withOrdinal(number: number): string {
    const suffices = [ 'th', 'st', 'nd', 'rd' ];
    const value = number % 100;

    return value + (suffices[ (value - 20) % 10 ] || suffices[value] || suffices[0]);
}

/**
 * Formats the given `dateTime` to a string according to the indicated `format`. The implementation
 * of this formatter follows the basic formatting rules of the DayJS library.
 *
 * `Instant`, `PlainDate`, `PlainDateTime` and `PlainTime` will be interpret as if they were in UTC,
 * whereas `ZonedDateTime` will maintain its associated timezone.
 *
 * Format | Output                | Description
 * -------|-----------------------|--------------------------------------
 * YY     | 18                    | Two-digit year
 * YYYY   | 2018                  | Four-digit year
 * M      | 1 - 12                | The month, beginning at 1
 * MM     | 01 - 12               | The month, 2-digits
 * MMM    | Jan - Dec             | The abbreviated month name
 * MMMM   | January - December    | The full month name
 * D      | 1 - 31                | The day of the month
 * DD     | 01 - 31               | The day of the month, 2-digits
 * Do     | 1st 2nd ... 31st      | Day of Month with ordinal
 * d      | 0 - 6                 | The day of the week, with Sunday as 0
 * dd     | Su - Sa               | The min name of the day of the week
 * ddd    | Sun - Sat             | The short name of the day of the week
 * dddd   | Sunday - Saturday     | The name of the day of the week
 * w      | 1 2 ... 52 53         | Week of year
 * ww     | 01 02 ... 52 53       | Week of year, 2-digits
 * Wo     | 1st 2nd ... 52nd 53rd | Week of year with ordinal
 * W      | 1 2 ... 52 53         | ISO Week of year
 * WW     | 01 02 ... 52 53       | ISO Week of year, 2-digits
 * H      | 0 - 23                | The hour
 * HH     | 00 - 23               | The hour, 2-digits
 * h      | 1 - 12                | The hour, 12-hour clock
 * hh     | 01 - 12               | The hour, 12-hour clock, 2-digits
 * k      | 1 - 24                | The hour, beginning at 1
 * kk     | 01 - 24               | The hour, 2-digits, beginning at 1
 * m      | 0 - 59                | The minute
 * mm     | 00 - 59               | The minute, 2-digits
 * s      | 0 - 59                | The second
 * ss     | 00 - 59               | The second, 2-digits
 * X      | 1360013296            | Unix Timestamp in second
 * x      | 1360013296123         | Unix Timestamp in millisecond
 * SSS    | 000 - 999             | The millisecond, 3-digits
 * SSSS   | 000 - 999             | The microsecond, 3-digits
 * Z      | +05:00                | The offset from UTC, ±HH:mm
 * ZZ     | +0500                 | The offset from UTC, ±HHmm
 * z      | EST                   | Abbreviated named offset
 * zzz    | Eastern Standard Time | Unabbreviated named offset
 * A      | AM PM                 | Meridiem, in capitals
 * a      | am pm                 | Meridiem, in lowercase
 * Q      | 1 - 4                 | Quarter
 *
 * @see https://day.js.org/docs/en/display/format
 * @see https://day.js.org/docs/en/plugin/advanced-format
 */
export function formatDate(dateTime: Temporal.Instant, format: string, locale?: string): string;
export function formatDate(
    dateTime: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.PlainTime,
    format: string, locale?: string): string;
export function formatDate(
    dateTime: Temporal.ZonedDateTime,
    format: string, locale?: string): string;
export function formatDate(dateTime: any, format: string, locale?: string): string {
    let zonedDateTime: Temporal.ZonedDateTime;

    if (dateTime instanceof Temporal.Instant) {
        zonedDateTime = dateTime.toZonedDateTimeISO('UTC');
    } else if (dateTime instanceof Temporal.PlainDate) {
        zonedDateTime = dateTime.toZonedDateTime('UTC');
    } else if (dateTime instanceof Temporal.PlainDateTime) {
        zonedDateTime = dateTime.toZonedDateTime('UTC', { disambiguation: 'earlier' });
    } else if (dateTime instanceof Temporal.PlainTime) {
        zonedDateTime = Temporal.PlainDate.from('1970-01-01')
            .toZonedDateTime('UTC')
            .withPlainTime(dateTime);
    } else if (dateTime instanceof Temporal.ZonedDateTime) {
        zonedDateTime = dateTime;
    } else {
        throw new Error(`Invalid value passed for DateTime (t=${typeof dateTime}, v=${dateTime})`);
    }

    const effectiveLocale = locale ?? 'en-GB';

    const matches = (match: string) => {
        switch (match) {
            case 'YY':
                return `${zonedDateTime.year}`.substr(2);
            case 'YYYY':
                return zonedDateTime.year;

            case 'M':
                return `${zonedDateTime.month}`;
            case 'MM':
                return `0${zonedDateTime.month}`.substr(-2);
            case 'MMM':
                return zonedDateTime.toLocaleString(effectiveLocale, { month: 'short' });
            case 'MMMM':
                return zonedDateTime.toLocaleString(effectiveLocale, { month: 'long' });

            case 'D':
                return `${zonedDateTime.day}`;
            case 'DD':
                return `0${zonedDateTime.day}`.substr(-2);
            case 'd':
                return `${zonedDateTime.dayOfWeek}`;
            case 'Do':  // advancedFormat plugin
                return withOrdinal(zonedDateTime.day);
            case 'dd':
                return zonedDateTime.toLocaleString(effectiveLocale, { weekday: 'narrow' });
            case 'ddd':
                return zonedDateTime.toLocaleString(effectiveLocale, { weekday: 'short' });
            case 'dddd':
                return zonedDateTime.toLocaleString(effectiveLocale, { weekday: 'long' });

            case 'W':  // advancedFormat plugin
            case 'w':  // advancedFormat plugin
                return `${zonedDateTime.weekOfYear || 0}`;
            case 'Wo':  // advancedFormat plugin
                return withOrdinal(zonedDateTime.weekOfYear || 0);
            case 'WW':  // advancedFormat plugin
            case 'ww':  // advancedFormat plugin
                return `0${zonedDateTime.weekOfYear}`.substr(-2);

            case 'H':
                return `${zonedDateTime.hour}`;
            case 'HH':
                return `0${zonedDateTime.hour}`.substr(-2);
            case 'h':
                return `${zonedDateTime.hour % 12}`;
            case 'hh':
                return `0${zonedDateTime.hour % 12}`.substr(-2);
            case 'k':  // advancedFormat plugin
                return `${zonedDateTime.hour + 1}`;
            case 'kk':  // advancedFormat plugin
                return `0${zonedDateTime.hour + 1}`.substr(-2);

            case 'm':
                return `${zonedDateTime.minute}`;
            case 'mm':
                return `0${zonedDateTime.minute}`.substr(-2);

            case 's':
                return `${zonedDateTime.second}`;
            case 'ss':
                return `0${zonedDateTime.second}`.substr(-2);

            case 'X':  // advancedFormat plugin
                return `${Math.floor(zonedDateTime.epochMilliseconds / 1000)}`;
            case 'x':  // advancedFormat plugin
                return `${zonedDateTime.epochMilliseconds}`;

            case 'SSS':
                return `00${zonedDateTime.millisecond}`.substr(-3);
            case 'SSSS':
                return `00${zonedDateTime.microsecond}`.substr(-3);

            case 'Z':
                return zonedDateTime.offset;
            case 'z':  // advancedFormat plugin
            case 'zzz':  // advancedFormat plugin
                return zonedDateTime.timeZoneId;
            case 'ZZ':
                return zonedDateTime.offset.replace(':', '');

            case 'A':
                return zonedDateTime.hour < 12 ? 'AM' : 'PM';
            case 'a':
                return zonedDateTime.hour < 12 ? 'am' : 'pm';

            case 'Q':  // advancedFormat plugin
                return `${Math.ceil(zonedDateTime.month / 3)}`;

            default:
                throw new Error(`Invalid formatting parameter received (f=${format}, v=${match})`);
        }
    };

    return format.replace(kFormatRegexp, (match, $1) => $1 || matches(match));
}

/**
 * The units that will be considered for the difference, in order. Each unit must be a valid
 * member of the `Temporal.Duration` type.
 */
const kDurationUnits: { [K in keyof Temporal.DurationLikeObject]?: string } = {
    'years': 'year',
    'months': 'month',
    'weeks': 'week',
    'days': 'day',
    'hours': 'hour',
    'minutes': 'minute',
    'seconds': 'second',
};

/**
 * Formats the given `duration`. The duration will be rounded to the largest unit, and will either
 * be prefixed or suffixed based on whether it happened in the past, or will happen in the future.
 *
 * @example 1 year ago, in 2 years
 * @example 1 month ago, in 11 months
 * @example 1 week ago, in 3 weeks
 * @example 1 day ago, in 6 days
 * @example 1 hour ago, in 21 hours
 * @example 1 minute ago, in 51 minutes
 * @example 1 second ago, in 30 seconds
 * @example now
 */
export function formatDuration(duration: Temporal.Duration, noPrefix?: boolean): string {
    if (duration.blank)
        return 'now';

    const prefix = !!noPrefix ? '' : (duration.sign > 0 ? 'in ' : '');
    const suffix = duration.sign < 0 ? ' ago' : '';

    for (const [ unit, name ] of Object.entries(kDurationUnits)) {
        if (!duration[unit as keyof Temporal.Duration])
            continue;

        // TODO: Figure out how to properly balance the dates, i.e. P1Y350D should be displayed as
        // "in 2 years" as opposed to "in 1 year". However, the current Temporal polyfill doesn't
        // seem to support the optional `relativeTo` property.
        const value = duration.abs()[unit as keyof Temporal.Duration];

        const plural = value !== 1 ? 's' : '';
        return `${prefix}${value} ${name}${plural}${suffix}`;
    }

    return 'now';  // fallback for millisecond, microsecond and nanosecond differences
}

/**
 * Returns whether `zdt` happens after `reference`.
 */
export function isAfter(pd: Temporal.PlainDate, reference: Temporal.PlainDate): boolean;
export function isAfter(zdt: Temporal.ZonedDateTime, reference: Temporal.ZonedDateTime): boolean;
export function isAfter<T>(input: T, reference: T): boolean {
    if (input instanceof Temporal.PlainDate)
        return Temporal.PlainDate.compare(input, reference as any) > 0;
    if (input instanceof Temporal.ZonedDateTime)
        return Temporal.ZonedDateTime.compare(input, reference as any) > 0;
    throw new Error(`Invalid type given to isAfter(): ${typeof input}`);
}

/**
 * Returns whether `zdt` happens before `reference`.
 */
export function isBefore(pd: Temporal.PlainDate, reference: Temporal.PlainDate): boolean;
export function isBefore(zdt: Temporal.ZonedDateTime, reference: Temporal.ZonedDateTime): boolean;
export function isBefore<T>(input: T, reference: T): boolean {
    if (input instanceof Temporal.PlainDate)
        return Temporal.PlainDate.compare(input, reference as any) < 0;
    if (input instanceof Temporal.ZonedDateTime)
        return Temporal.ZonedDateTime.compare(input, reference as any) < 0;
    throw new Error(`Invalid type given to isBefore(): ${typeof input}`);
}

/**
 * Converts the given `date` in the user's local timezone to a Temporal `ZonedDateTime` object.
 */
export function fromLocalDate(date: Date): Temporal.ZonedDateTime {
    return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO('UTC');
}

/**
 * Converts the given `input` to a regular JavaScript `Date` object.
 */
export function toLocalDate(input: Temporal.ZonedDateTime): Date {
    return new Date(
        input.withTimeZone(Temporal.Now.timeZoneId()).epochMilliseconds);
}
