// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { FormContainer } from '@proxy/react-hook-form-mui';
import { useCallback, useState } from 'react';

import Box from '@mui/material/Box';

import type { PageInfoWithTeam } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import type { TimelineEvent } from '@AnimeNL/volunteer-manager-timeline';
import { ShiftDemandTimeline, type ShiftDemandTeamInfo } from './ShiftDemandTimeline';
import { SubmitCollapse } from '@app/admin/components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <ShiftDemandSection> component.
 */
interface ShiftDemandSectionProps {
    /**
     * Information about the event for which the demand section is being shown.
     */
    event: PageInfoWithTeam['event'];

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
    const { demand, event, readOnly, step, team } = props;

    const [ error, setError ] = useState<string | undefined>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const [ entries, setEntries ] = useState<TimelineEvent[]>(demand);

    // ---------------------------------------------------------------------------------------------
    // Section: Management of the demand table
    // ---------------------------------------------------------------------------------------------

    const handleChange = useCallback((entries: TimelineEvent[]) => {
        setEntries(entries);
        setInvalidated(true);
    }, [ /* no dependencies */ ]);

    const handleSubmit = useCallback(async () => {
        setError(undefined);
        setLoading(true);
        try {
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

            const result = await callApi('put', '/api/admin/event/shifts/:id', {
                context: {
                    event: event.slug,
                    team: team.slug,
                },
                id: props.shiftId,
                row: {
                    id: props.shiftId,
                    demand: JSON.stringify(normalisedEntries),

                    colour: '',  // ignored
                    category: '',  // ignored
                    categoryOrder: 0,  // ignored
                    excitement: 0,  // ignored
                },
            });

            if (!!result.success)
                setInvalidated(false);
            else
                setError(result.error ?? 'Unable to update demand in the database.');

        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ entries, event, props.shiftId, team ]);

    return (
        <FormContainer onSuccess={handleSubmit}>
            <Box>
                <ShiftDemandTimeline onChange={handleChange} entries={entries} event={event}
                                     readOnly={readOnly} step={step} team={team} />
            </Box>
            <SubmitCollapse error={error} open={invalidated} loading={loading} sx={{ mt: 2 }} />
        </FormContainer>
    );
}
