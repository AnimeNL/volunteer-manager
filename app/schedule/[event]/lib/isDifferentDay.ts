// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';


/**
 * At which hour does the logical festival day change?
 */
export const kLogicalDayChangeHour = 4;

/**
 * Returns whether the given `referenceDateTime` and `currentDateTime` are on different days. This
 * is determined based on logical festival days, i.e. [06:00-03:00].
 *
 * @note
 * This method is known to have issues with multi-year comparisons (e.g. `currentDateTime` is on
 * the 100th day in 2023, whereas `referenceDateTime` is on the 100th day in 2024), as well as with
 * dates around the new year where there is no such thing as day 367. This is a reasonably hot code
 * path, so rather than doing additional calculations we've decided not to optimise for these cases.
 */
export function isDifferentDay(
    currentDateTime: Temporal.ZonedDateTime, referenceDateTime: Temporal.ZonedDateTime): boolean
{
    const currentDay = currentDateTime.dayOfYear;
    const referenceDay = referenceDateTime.dayOfYear;

    if (currentDay === referenceDay) {
        // Exception: |currentDateTime| happens before |kLogicalDayChangeHour|, whereas the
        // |referenceDateTime| happens after.
        const currentBeforeLogicalDayChange = currentDateTime.hour < kLogicalDayChangeHour;
        const referenceBeforeLogicalDayChange = referenceDateTime.hour < kLogicalDayChangeHour;

        return currentBeforeLogicalDayChange !== referenceBeforeLogicalDayChange;

    } else {
        // Exception: |currentDateTime| is one day before |referenceDateTime| and the event on
        // |referenceDateTime| happens before |kLogicalDayChangeHour|.
        if (currentDay === (referenceDay + 1) && referenceDateTime.hour < kLogicalDayChangeHour)
            return false;

        return true;
    }
}
