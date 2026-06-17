// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { SelectElement } from '@proxy/react-hook-form-mui';
import { useCallback, useState } from 'react';

import type { TimelineEventMutation } from '@AnimeNL/volunteer-manager-timeline';
import { SettingDialog } from '@app/admin/components/SettingDialog';
import { Temporal } from '@lib/Temporal';
import { Timeline, type TimelineEvent } from '@app/admin/components/Timeline';

/**
 * Promise resolver function used with the ability to modify timeslots.
 */
type PromiseResolver = (response?: TimelineEventMutation) => void;

/**
 * States that are valid for the availability timeline.
 */
type ValidStates = 'available' | 'avoid' | 'unavailable';

/**
 * Colours to use in the <AvailabilityTimeline> component.
 */
export const kAvailabilityTimelineColours: { [k in ValidStates]: string } = {
    available: '#2E7D32',
    avoid: '#FFC107',
    unavailable: '#37474F',
};

/**
 * Titles to use in the <AvailabilityTimelineImpl> component.
 */
export const kAvailabilityTimelineTitles: { [k in ValidStates]: string } = {
    available: 'Available',
    avoid: 'Avoid',
    unavailable: 'Unavailable',
};

/**
 * Options that can be chosen in the availability exception configuration dialog.
 */
const kExceptionTypeOptions = [
    { id: 'available', label: 'Available for shifts' },
    { id: 'avoid', label: 'Avoid shifts' },
    { id: 'unavailable', label: 'Unavailable for shifts' },
];

/**
 * Props accepted by the <AvailabilityTimelineImpl> component.
 */
interface AvailabilityTimelineImplProps {
    /**
     * Called when any mutation has been made to the availability timeline, which includes created
     * events, updated events and deleted events.
     */
    onChange?: (timeslots: TimelineEvent[]) => void;

    /**
     * The event for which the timeline is being shown.
     */
    event: {
        startTime: string;
        endTime: string;
        timezone: string;
    };

    /**
     * Whether the timeline should be displayed in a read-only manner.
     */
    readOnly?: boolean;

    /**
     * Time step, in minutes, defining the granularity of events in the exception view.
     */
    step?: number;

    /**
     * The timeslots that should be displayed on the timeline. Timeslots should not overlap with
     * each other, as availability state is mutually exclusive information.
     */
    timeslots: TimelineEvent[];
}

/**
 * The <AvailabilityTimelineImpl> component is the implementation of the <AvailabilityTimeline>
 * specific to the AnimeCon Volunteer Manager, integrated with MUI.
 */
export function AvailabilityTimelineImpl(props: AvailabilityTimelineImplProps) {
    const { onChange, event, readOnly, step, timeslots } = props;

    // ---------------------------------------------------------------------------------------------

    const [ selectedEvent, setSelectedEvent ] = useState<TimelineEvent | undefined>();
    const [ selectedResolver, setSelectedResolver ] = useState<PromiseResolver | undefined>();

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
            return { error: <>I forgot which timeslot was selected, sorry!</> };

        selectedResolver(/* delete= */ { delete: true });
        return { close: true } as const;

    }, [ selectedResolver, selectedEvent ]);

    const handleSettingsUpdate = useCallback(async (data: any) => {
        if (!selectedEvent || !selectedResolver)
            return { error: <>I forgot which timeslot was selected, sorry!</> };

        if (![ 'unavailable', 'avoid', 'available' ].includes(data.animeConState))
            return { error: <>I don't know which state to update to, sorry!</> };

        const state = data.animeConState as ValidStates;
        selectedResolver({
            update: {
                ...selectedEvent,
                title: kAvailabilityTimelineTitles[state],
                color: kAvailabilityTimelineColours[state],
                animeConState: state
            }
        });

        return { close: true } as const;

    }, [ selectedResolver, selectedEvent ]);

    // ---------------------------------------------------------------------------------------------

    const eventDefaults: Partial<TimelineEvent> = {
        title: kAvailabilityTimelineTitles['unavailable'],
        color: kAvailabilityTimelineColours['unavailable'],
        animeConState: 'unavailable',
    };

    const min = Temporal.ZonedDateTime.from(event.startTime)
        .withTimeZone(event.timezone).with({ hour: 6, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const max = Temporal.ZonedDateTime.from(event.endTime)
        .withTimeZone(event.timezone).with({ hour: 22, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    return (
        <>
            <Timeline min={min} max={max} step={step} displayTimezone={event.timezone}
                      events={timeslots} onChange={onChange} onDoubleClick={handleSettings}
                      disableGutters eventDefaults={eventDefaults} eventOverlap={false}
                      readOnly={readOnly} subject="exception" />
            <SettingDialog title="Availability exception" delete open={!!selectedEvent}
                           onClose={handleSettingsClose} onDelete={handleSettingsDelete}
                           onSubmit={handleSettingsUpdate} defaultValues={ selectedEvent ?? {} }>
                <SelectElement name="animeConState" size="small" fullWidth sx={{ mt: '1px' }}
                               options={kExceptionTypeOptions} />
            </SettingDialog>
        </>
    );
}
