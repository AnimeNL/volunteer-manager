// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { SelectElement } from '@proxy/react-hook-form-mui';
import { useCallback, useContext, useEffect, useState } from 'react';

import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { SettingDialog } from '@app/admin/components/SettingDialog';
import { Temporal } from '@lib/Temporal';
import { Timeline, type TimelineEvent, type TimelineEventMutation } from '@app/admin/components/Timeline';
import { VisibilityContext } from './ShiftTeamVisibilityContext';

/**
 * Promise resolver function used with the ability to modify demand.
 */
type PromiseResolver = (value?: TimelineEventMutation) => void;

/**
 * Information about the team for which demand is being managed.
 */
export interface ShiftDemandTeamInfo {
    /**
     * HTML color used to represent the team that's being managed.
     */
    colour: string;

    /**
     * Plural label to use when identifying this team.
     */
    plural: string;

    /**
     * Unique slug that identifies this team in a URL.
     */
    slug: string;
}

/**
 * Props accepted by the <ShiftDemandTimeline> component.
 */
interface ShiftDemandTimelineProps {
    /**
     * Called when any mutation has been made to the demand.
     */
    onChange?: (events: TimelineEvent[]) => void;

    /**
     * Entries that should be shown on the timeline. Uncontrolled.
     */
    entries: TimelineEvent[];

    /**
     * Information about the event for which the demand section is being shown.
     */
    event: PageInfo['event'];

    /**
     * Whether the timeline should be shown in read-only mode, i.e. everything is immutable.
     */
    readOnly?: boolean;

    /**
     * Time step, in minutes, defining the granularity of events in the shift overview.
     */
    step?: number;

    /**
     * Information about the team for which demand is being managed.
     */
    team: ShiftDemandTeamInfo;
}

/**
 * The <ShiftDemandTimeline> component implements the <Timeline> component provided by our calendar
 * library, with additional user interface expected by the Volunteer Manager.
 */
export function ShiftDemandTimeline(props: ShiftDemandTimelineProps) {
    const { onChange, event, readOnly, step, team } = props;

    const includeAllTeams = useContext(VisibilityContext);

    // ---------------------------------------------------------------------------------------------

    const [ selectedShiftEntry, setSelectedShiftEntry ] = useState<TimelineEvent | undefined>();
    const [ selectedResolver, setSelectedResolver ] = useState<PromiseResolver | undefined>();

    const handleSettings = useCallback(async (entry: TimelineEvent) => {
        if (!entry.editable || !entry.volunteers || !entry.animeConLabel)
            return undefined;

        return new Promise<TimelineEventMutation | undefined>(resolve => {
            setSelectedShiftEntry(entry);
            setSelectedResolver(() => resolve);
        });
    }, [ /* no deps */ ]);

    const handleSettingsClose =
        useCallback(() => setSelectedShiftEntry(undefined), [ /* no deps */ ]);

    const handleSettingsDelete = useCallback(async () => {
        if (!selectedShiftEntry || !selectedResolver)
            return { error: <>I forgot which shift was selected, sorry!</> };

        selectedResolver({ delete: true });
        return { close: true } as const;

    }, [ selectedResolver, selectedShiftEntry ]);

    const handleSettingsUpdate = useCallback(async (data: any) => {
        if (!selectedShiftEntry || !selectedResolver)
            return { error: <>I forgot which shift was selected, sorry!</> };

        if (typeof data.volunteers !== 'number' || data.volunteers < 1 || data.volunteers > 10)
            return { error: <>I don't know which state to update to, sorry!</> };

        selectedResolver({
            update: {
                ...selectedShiftEntry,
                volunteers: data.volunteers,
                title: data.volunteers === 1
                    ? `1 ${selectedShiftEntry.animeConLabel.singular}`
                    : `${data.volunteers} ${selectedShiftEntry.animeConLabel.plural}`
            },
        });

        return { close: true } as const;

    }, [ selectedResolver, selectedShiftEntry ]);

    // ---------------------------------------------------------------------------------------------

    const [ entries, setEntries ] = useState<TimelineEvent[]>(props.entries);
    useEffect(() => {
        setEntries(entries => {
            const mutableEntries = entries.filter(entry => !!entry.editable);
            if (!!includeAllTeams) {
                return [
                    ...props.entries.filter(entry => !entry.editable),
                    ...mutableEntries,
                ];
            } else {
                return [
                    ...props.entries.filter(entry => entry.title === 'Timeslot'),
                    ...mutableEntries,
                ];
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ includeAllTeams, props.entries.filter ]);

    // ---------------------------------------------------------------------------------------------

    const numberOfVolunteerOptions = Array(10).fill(null).map((_, index) => ({
        id: index + 1,
        label: `${index + 1} ${index === 0 ? team.plural.replace(/s$/, '') : team.plural}`,
    }));

    // ---------------------------------------------------------------------------------------------

    const min = Temporal.ZonedDateTime.from(event.startTime)
        .withTimeZone(event.timezone).with({ hour: 6, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const max = Temporal.ZonedDateTime.from(event.endTime)
        .withTimeZone(event.timezone).with({ hour: 22, minute: 0, second: 0 })
            .toString({ timeZoneName: 'never' });

    const eventDefaults: Partial<TimelineEvent> = {
        color: team.colour,
        editable: true,
        title: `1 ${team.plural.replace(/s$/, '')}`,

        // Internal information:
        volunteers: 1,
        animeConLabel: {
            singular: team.plural.replace(/s$/, ''),
            plural: team.plural,
        },
    };

    return (
        <>
            <Timeline min={min} max={max} displayTimezone={event.timezone} events={entries}
                      eventDefaults={eventDefaults} onChange={onChange}
                      onDoubleClick={handleSettings} dense readOnly={readOnly} step={step} />
            <SettingDialog title="Number of volunteers" delete open={!!selectedShiftEntry}
                           onClose={handleSettingsClose} onDelete={handleSettingsDelete}
                           onSubmit={handleSettingsUpdate}
                           defaultValues={ selectedShiftEntry ?? {} }>
                <SelectElement name="volunteers" size="small" fullWidth sx={{ mt: '1px' }}
                               options={numberOfVolunteerOptions} />
            </SettingDialog>
        </>
    );
}
