// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Temporal } from '@lib/Temporal';

declare namespace globalThis {
    let animeConTimeCache: Map<number, Temporal.ZonedDateTime>;
    let animeConTimeOffset: number;
    let animeConTimezone: string;
}

/**
 * Initialise the global time configuration to no offset, defaulting to UTC.
 */
globalThis.animeConTimeCache ??= new Map;
globalThis.animeConTimeOffset ??= 0;
globalThis.animeConTimezone ??= 'utc';

/**
 * Returns the current time in a Temproal `Instant` representation.
 */
export function currentInstant(): Temporal.Instant {
    const currentInstant = Temporal.Now.instant();
    return !!globalThis.animeConTimeOffset
        ? currentInstant.add({ seconds: globalThis.animeConTimeOffset })
        : currentInstant;
}

/**
 * Returns the current time as a UNIX timestamp, represented in number of seconds since 1970 in UTC.
 */
export function currentTimestamp(): number {
    return Math.round(currentInstant().epochMilliseconds / 1000);
}

/**
 * Returns the current timezone in which the portal operates.
 */
export function currentTimezone(): string {
    return globalThis.animeConTimezone;
}

/**
 * Return the current time in a Temporal `ZonedDateTime` representation.
 */
export function currentZonedDateTime(): Temporal.ZonedDateTime {
    return currentInstant().toZonedDateTimeISO(globalThis.animeConTimezone);
}

/**
 * Converts the given `unixTimestamp` to a Temporal `ZonedDateTime` representation in the timezone
 * that's applicable to the event. The `ZonedDateTime` objects are immutable, and will thus be
 * cached for the lifetime of the current page load.
 */
export function toZonedDateTime(unixTimestamp: number): Temporal.ZonedDateTime {
    let zonedDateTime = globalThis.animeConTimeCache.get(unixTimestamp);
    if (!zonedDateTime) {
        zonedDateTime = Temporal.Instant.fromEpochMilliseconds(unixTimestamp * 1000)
            .toZonedDateTimeISO(globalThis.animeConTimezone);

        globalThis.animeConTimeCache.set(unixTimestamp, zonedDateTime);
    }

    return zonedDateTime;
}

/**
 * Updates the default timezone to `timezone`, and the time offset to apply to the Volunteer Manager
 * to the given `offset`, indicated in seconds, if any.
 */
export function updateTimeConfig(offset: number | undefined, timezone: string): void {
    if (timezone !== globalThis.animeConTimezone)
        globalThis.animeConTimeCache = new Map;

    globalThis.animeConTimeOffset = offset ?? 0;
    globalThis.animeConTimezone = timezone;
}
