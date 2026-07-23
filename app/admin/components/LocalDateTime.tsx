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
     * An ISO 8601 date + time + offset format, a bracketed time zone suffix, and (if the calendar
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
        const dateTime = Temporal.ZonedDateTime.from(props.dateTime);
        const localDateTime = dateTime.withTimeZone(Temporal.Now.timeZoneId());

        return formatDate(localDateTime, props.format);

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
