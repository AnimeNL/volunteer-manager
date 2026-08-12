// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import Dialog from '@mui/material/Dialog';

import { Calendar, type CalendarEvent } from '@AnimeNL/volunteer-manager-timeline';
import '@AnimeNL/volunteer-manager-timeline/dist/volunteer-manager-timeline.css';

import type { DisplayShiftInfo } from '../DisplayContext';
import { determineColour } from '@components/Avatar';

/**
 * Indicator on when a particula shift has taken place.
 */
type ScheduleTense = 'past' | 'active' | 'future';

/**
 * Props accepted by the <VolunteersDialog> component.
 */
interface VolunteersDialogProps {
    /**
     * Callback to call when the dialog should be closed.
     */
    onClose: () => void;

    /**
     * Information about the event for which the dialog is being shown.
     */
    event: { start: string; end: string; };

    /**
     * Whether the dialog should be opened.
     */
    open?: boolean;

    /**
     * Timezone in which any times should be displayed in the user interface.
     */
    timezone: string;

    /**
     * Volunteers that will be helping out in this location.
     */
    schedule: { [k in ScheduleTense]: DisplayShiftInfo[] };
}

/**
 * The <VolunteersDialog> component displays a sizeable dialog that provides access to the full
 * schedule of volunteers who are expected to help out at this location.
 */
export function VolunteersDialog(props: VolunteersDialogProps) {
    const { onClose, event, open, timezone, schedule } = props;

    const events = useMemo(() => {
        const events: CalendarEvent[] = [ /* empty */ ];
        for (const type of [ 'past', 'active', 'future' ] as ScheduleTense[]) {
            for (const event of schedule[type]) {
                events.push({
                    id: event.id,
                    start: Temporal.Instant.fromEpochMilliseconds(event.start * 1000).toString(),
                    end: Temporal.Instant.fromEpochMilliseconds(event.end * 1000).toString(),
                    title: event.name,
                    color: determineColour(event.name),
                });
            }
        }

        return events;

    }, [ schedule ]);

    const { min, max } = useMemo(() => {
        return {
            min: Temporal.ZonedDateTime.from(event.start).withTimeZone(timezone)
                .with({ hour: 0, minute: 0, second: 0 }).toString({ timeZoneName: 'never' }),
            max: Temporal.ZonedDateTime.from(event.end).withTimeZone(timezone)
                .with({ hour: 23, minute: 59, second: 59 }).toString({ timeZoneName: 'never' }),
        };
    }, [ event, timezone ]);

    return (
        <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="md"
                sx={{
                    '& .mbsc-material-dark.mbsc-eventcalendar': {
                        backgroundColor: 'transparent',
                    },
                    '& .MuiPaper-root': {
                        maxHeight: '80vh !important',
                    },
                }}>

            <Calendar displayTimezone={timezone} min={min} max={max} temporal={Temporal}
                      events={events} view="mobile" theme="dark" />

        </Dialog>
    );
}
