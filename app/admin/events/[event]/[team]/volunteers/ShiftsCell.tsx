// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Typography from '@mui/material/Typography';

import type { VolunteerRowModel } from '../volunteers2/page';

/**
 * Formats the given number of `seconds` to a friendly string like "2 hours", "1:30 hours", or
 * "45 minutes".
 */
function formatSeconds(seconds?: number): string {
    if (!seconds)
        return '-';

    const minutesTotal = Math.floor(seconds / 60);
    const hours = Math.floor(minutesTotal / 60);
    const minutes = minutesTotal % 60;

    if (hours > 0) {
        if (minutes > 0)
            return `${hours}:${('00' + minutes).slice(-2)} hours`;

        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Cell used to display the formatted scheduled hours.
 */
export function ShiftsCell(props: { row: VolunteerRowModel }) {
    if (!props.row.shiftSeconds) {
        return (
            <Typography component="span" variant="body2" color="textDisabled">
                ···
            </Typography>
        );
    }

    return (
        <Typography component="span" variant="body2">
            {formatSeconds(props.row.shiftSeconds)}
        </Typography>
    );
}
