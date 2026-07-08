// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { Temporal, formatDuration } from '@lib/Temporal';

/**
 * Props accepted by the <LocalDateDuration> component.
 */
interface LocalDateDurationProps {
    /**
     * An ISO 8601 date + time + offset format, a bracketed time zone suffix, and (if the calendar
     * is not iso8601) a calendar suffix.
     */
    dateTime: string;

    /**
     * Whether the prefix and/or suffix should be added ("in ...", "... ago").
     * @default true
     */
    noPrefix?: boolean;
}

/**
 * Displays the time duration since the given `dateTime` in the user's local timezone.
 */
export function LocalDateDuration(props: LocalDateDurationProps) {
    return useMemo(() => {
        const dateTime = Temporal.ZonedDateTime.from(props.dateTime);
        const localDateTime = Temporal.Now.zonedDateTimeISO(dateTime.timeZoneId);

        return formatDuration(
            dateTime.since(localDateTime, { largestUnit: 'days' }), props.noPrefix);

    }, [ props.dateTime, props.noPrefix ]);
}
