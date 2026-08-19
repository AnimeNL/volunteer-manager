// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import type { TimelineEventMutation } from '@AnimeNL/volunteer-manager-timeline';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';
import { Timeline, type TimelineEvent } from '@app/admin/components/Timeline';

import { kAvailabilityTimelineColours, kAvailabilityTimelineTitles, kExceptionTypeOptions }
    from './AvailabilitySettings';

/**
 * Props accepted by the <AvailabilityFormTimeline> component.
 */
interface AvailabilityFormTimelineProps {
    /**
     * Called when the availability timeline changes.
     */
    onChange?: (timeslots: TimelineEvent[]) => void;

    /**
     * The event for which the timeline is shown.
     */
    event: {
        startTime: string;
        endTime: string;
        timeZone: string;
    };

    /**
     * Displays the timeline in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Time step in minutes for timeline items.
     */
    step?: number;

    /**
     * The timeslots displayed on the timeline.
     */
    timeslots: TimelineEvent[];
}

/**
 * Displays and manages volunteer availability exception intervals on a timeline.
 */
export default function AvailabilityFormTimeline(props: AvailabilityFormTimelineProps) {
    const { onChange, event, readOnly, step, timeslots } = props;

    // ---------------------------------------------------------------------------------------------

    const [ selectedEvent, setSelectedEvent ] = useState<TimelineEvent | undefined>();
    const [ selectedResolver, setSelectedResolver ] =
        useState<(response?: TimelineEventMutation) => void | undefined>();

    const handleSettings = useCallback(async (event: TimelineEvent) => {
        return new Promise<TimelineEventMutation | undefined>(resolve => {
            setSelectedEvent(event);
            setSelectedResolver(() => resolve);
        });
    }, [ /* no deps */ ]);

    const handleSettingsClose =
        useCallback(() => setSelectedEvent(undefined), [ /* no deps */ ]);

    const handleSettingsDelete = useCallback(async () => {
        if (!selectedEvent || !selectedResolver)
            throw new Error('Context on the selected timeslot has been lost.');

        selectedResolver(/* delete= */ { delete: true });
        return { close: true } as const;

    }, [ selectedResolver, selectedEvent ]);

    const handleSettingsUpdate = useCallback(async (data: any) => {
        if (!selectedEvent || !selectedResolver)
            return;

        if (![ 'unavailable', 'avoid', 'available' ].includes(data))
            return;

        const state = data as keyof typeof kAvailabilityTimelineTitles;
        selectedResolver({
            update: {
                ...selectedEvent,
                title: kAvailabilityTimelineTitles[state],
                color: kAvailabilityTimelineColours[state],
                animeConState: state,
            },
        });

        setSelectedEvent(undefined);

    }, [ selectedResolver, selectedEvent ]);

    // ---------------------------------------------------------------------------------------------

    const eventDefaults: Partial<TimelineEvent> = {
        title: kAvailabilityTimelineTitles['unavailable'],
        color: kAvailabilityTimelineColours['unavailable'],
        animeConState: 'unavailable',
    };

    const min = Temporal.ZonedDateTime.from(event.startTime)
        .withTimeZone(event.timeZone).with({ hour: 6, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const max = Temporal.ZonedDateTime.from(event.endTime)
        .withTimeZone(event.timeZone).with({ hour: 22, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    return (
        <>
            <Timeline min={min} max={max} step={step} displayTimezone={event.timeZone}
                      events={timeslots} onChange={onChange} onDoubleClick={handleSettings}
                      disableGutters eventDefaults={eventDefaults} eventOverlap={false}
                      readOnly={readOnly} subject="exception" />

            <ResponsiveDialog
                open={!!selectedEvent} onClose={handleSettingsClose}
                title="Availability exception"
                description="What type of exception are you configuring?"
                additionalButtons={
                    <Button size="small" variant="contained" color="error"
                            onClick={handleSettingsDelete}>
                        Delete
                    </Button>
                }>

                <Stack direction="column" spacing={2}>
                    { Object.values(kExceptionTypeOptions).map(({ id, label }) =>
                        <Button variant="contained" color="success" size="small" fullWidth
                                onClick={ handleSettingsUpdate.bind(null, id) } key={id}>
                            {label}
                        </Button> )}
                </Stack>

            </ResponsiveDialog>
        </>
    );
}
