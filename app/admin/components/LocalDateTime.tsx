// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { formatDate } from '@lib/Temporal';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <LocalDateTime> component.
 */
interface LocalDateTimeProps {
    /**
     * Date and time to display in this component. This either can be a plain date (YYYY-MM-DD), or
     * an ISO 8601 date + time + offset format, a bracketed time zone suffix, and (if the calendar
     * is not iso8601) a calendar suffix.
     */
    dateTime: string;

    /**
     * Whether the numbers composing this date should be rendered in a fixed width.
     */
    fixedWidth?: boolean;

    /**
     * Format in which the date and time should be displayed. The supported formatting rules are
     * equal to those of the `formatDate` function we support for Temporal.
     */
    format: string;
}

/**
 * Displays a given time in the user's local timezone.
 */
export function LocalDateTime(props: LocalDateTimeProps) {
    const formattedDateTime = useMemo(() => {
        let dateTime: Temporal.PlainDate | Temporal.ZonedDateTime;
        if (props.dateTime.length === /** len(YYYY-MM-DD)= */ 10) {
            dateTime = Temporal.PlainDate.from(props.dateTime);
        } else {
            const zonedDateTime = Temporal.ZonedDateTime.from(props.dateTime);
            dateTime = zonedDateTime.withTimeZone(Temporal.Now.timeZoneId());
        }

        return formatDate(dateTime, props.format);

    }, [ props.dateTime, props.format ]);

    return !!props.fixedWidth
        ? <FixedWidthLocalDateTime>{formattedDateTime}</FixedWidthLocalDateTime>
        : formattedDateTime;
}

/**
 * Helper element to display the date in a tabular format.
 */
const FixedWidthLocalDateTime = styled('span')(() => ({
    fontFeatureSettings: 'tnum',
    fontVariantNumeric: 'tabular-nums',
}));
