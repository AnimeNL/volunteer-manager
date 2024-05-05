// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import type { PublicSchedule } from '@app/api/event/schedule/getSchedule';
import { ScheduleContext, type ScheduleContextInfo } from './ScheduleContext';
import { updateTimeConfig } from './CurrentTime';

/**
 * Fetcher used to retrieve the schedule from the server.
 */
const scheduleFetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Props accepted by the <ScheduleContextManager> component.
 */
export interface ScheduleContextManagerProps {
    /**
     * Unique slug of the event for which the context should be managed.
     */
    event: string;
}

/**
 * The <ScheduleContextManager> component powers the context used by the entire schedule app. It
 * periodically updates it, and makes sure that state is refreshed when connectivity state changes.
 */
export function ScheduleContextManager(props: React.PropsWithChildren<ScheduleContextManagerProps>)
{
    // Load the schedule using SWR. The endpoint will be composed based on the props given to this
    // component, given to the manager by the server.
    const endpoint = useMemo(() => {
        const endpointParams = new URLSearchParams;
        endpointParams.set('event', props.event);

        return `/api/event/schedule?${endpointParams.toString()}`;

    }, [ props.event ]);

    const { data, error, isLoading, mutate } = useSWR<PublicSchedule>(endpoint, scheduleFetcher, {
        // TODO: Select the appropriate options
    });

    // TODO: Deal with `error`?
    // TODO: Deal with `isLoading`?

    // ---------------------------------------------------------------------------------------------

    // Callback through which components can manually request a refresh of the schedule. This is
    // appropriate to do whenever a data mutation is submitted in the portal.
    const refresh = useCallback(() => mutate(), [ mutate ]);

    // Store the `data` in a context so that we can guarantee ordering of state and context updates
    // in the schedule app. This avoids race conditions where outdated information is shown.
    const [ context, setContext ] = useState<ScheduleContextInfo>({ schedule: data });
    useEffect(() => {
        // Update the portal's time configuration when this has been provided by the server.
        updateTimeConfig(data?.config.timeOffset, data?.config.timezone || 'utc');

        // Update the `context`, which is consumed by various parts of the schedule app.
        setContext({
            refresh,
            schedule: data
        });

    }, [ data, refresh ]);

    return (
        <ScheduleContext.Provider value={context}>
            {props.children}
        </ScheduleContext.Provider>
    );
}
