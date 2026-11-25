// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { CalendarProps, ScheduleProps, TimelineProps }
    from '@AnimeNL/volunteer-manager-timeline';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

/**
 * Fallback components for the optional `@AnimeNL/volunteer-manager-timeline` package. Used when
 * the private package is not installed in `node_modules`, allowing builds and runtime rendering to
 * degrade gracefully.
 */
function UnavailableNotice(props: { component: string }) {
    return (
        <Alert severity="info">
            <AlertTitle>{props.component} unavailable</AlertTitle>
            The optional <code>@AnimeNL/volunteer-manager-timeline</code> package is not installed
            in this environment.
        </Alert>
    );
}

export function Calendar(_props: CalendarProps) {
    return <UnavailableNotice component="Calendar" />;
}

export function Schedule(_props: ScheduleProps) {
    return <UnavailableNotice component="Schedule" />;
}

export function Timeline(_props: TimelineProps) {
    return <UnavailableNotice component="Timeline" />;
}
