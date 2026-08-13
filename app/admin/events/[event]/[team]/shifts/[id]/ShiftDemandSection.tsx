// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import type { TimelineEvent } from '@AnimeNL/volunteer-manager-timeline';
import { FormGrid } from '@app/admin/components/FormGrid';
import { ShiftDemandTimeline, type ShiftDemandTeamInfo } from './ShiftDemandTimeline';

/**
 * Props accepted by the <ShiftDemandSection> component.
 */
interface ShiftDemandSectionProps {
    /**
     * Server Action through which shifts can be saved.
     */
    action: ServerAction;

    /**
     * Information about the event for which the demand section is being shown.
     */
    event: {
        /**
         * Date and time at which the event will commence, in a ZonedDateTime serialisation.
         */
        startTime: string;

        /**
         * Date and time at which the event will conclude, in a ZonedDateTime serialisation.
         */
        endTime: string;

        /**
         * Name of the timezone in which the shifts are being scheduled.
         */
        timezone: string;
    };

    /**
     * Demand that exists for this shift. Includes immutable entries such as timeslots and demand
     * created for other teams, as well as mutable entries, namely demand for the current team.
     */
    demand: TimelineEvent[];

    /**
     * Whether the demand section should be shown in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Unique ID of the shift this section is being shown for, as it exists in the database.
     */
    shiftId: number;

    /**
     * Time step, in minutes, defining the granularity of events in the shift overview.
     */
    step?: number;

    /**
     * Information about the team for whom demand is being shown.
     */
    team: ShiftDemandTeamInfo;
}

/**
 * The <ShiftDemandSection> component contains an overview of the requested demand for this
 * particular shift. It flags any associated timeslots on the program, as well as shifts that the
 * other teams involved in this festival may have scheduled.
 */
export function ShiftDemandSection(props: ShiftDemandSectionProps) {
    const [ entries, setEntries ] = useState<TimelineEvent[]>(props.demand);

    const handleChange = useCallback((entries: TimelineEvent[]) => setEntries(entries), [ ]);
    const handleSubmit = useCallback(async () => {
        if (props.readOnly)
            return { success: false, error: 'Unable to edit a form in readonly mode' };

        const normalisedEntries = [];
        for (const entry of entries) {
            if (!Object.hasOwn(entry, 'editable') || !entry.editable)
                continue;  // the entry is not editable
            if (!Object.hasOwn(entry, 'start') || !Object.hasOwn(entry, 'end'))
                continue;  // invalid entry due to the calendar library
            if (!Object.hasOwn(entry, 'volunteers') || typeof entry.volunteers !== 'number')
                continue;  // invalid entry due to our own fault

            normalisedEntries.push({
                start: entry.start,
                end: entry.end,
                volunteers: entry.volunteers,
            });
        }

        return props.action({ demand: normalisedEntries });

    }, [ entries, props.action, props.readOnly ]);

    return (
        <FormGrid action={handleSubmit}>
            <Grid size={{ xs: 12 }}>
                <ShiftDemandTimeline onChange={handleChange} entries={entries} event={props.event}
                                     readOnly={props.readOnly} step={props.step} team={props.team} />
            </Grid>
        </FormGrid>
    );
}
