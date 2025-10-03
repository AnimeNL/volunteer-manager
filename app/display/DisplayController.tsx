// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';

import type { DisplayDefinition } from '@app/api/display/route';
import { DisplayContext, type DisplayContextInfo } from './DisplayContext';
import { DisplayTheme } from './DisplayTheme';
import {
    onceInitialiseGlobals, getColorValue, markUpdateCompleted, isLockedValue, setColorValue,
    setLockedValue, setTimeOffset} from './Globals';

import device from './lib/Device';

/**
 * How frequently should the display check in with the server? Can be configured by the server.
 */
const kDefaultUpdateFrequencyMs = /* 5 minutes= */ 5 * 60 * 1000;

/**
 * Fetcher used to retrieve the schedule from the server.
 */
const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Decomposes the given `color` into an array of [R, G, B] values in range of [0-255)
 */
function decomposeColor(color: string | undefined): [ number, number, number ] {
    if (typeof color === 'string') {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        if (!!result)
            return [ parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16) ];
    }

    return [ 0, 0, 0 ];  // turn the lights off
}

/**
 * The <DisplayController> component controls the display; it manages the display's state with the
 * Volunteer Manager server and makes sure that it continues to be periodically updated.
 */
export function DisplayController(props: React.PropsWithChildren) {
    onceInitialiseGlobals();

    // ---------------------------------------------------------------------------------------------

    // URL from which information about this display can be loaded.
    const url = '/api/display';

    // Periodically update the display's configuration using the `SWR` library. The interval can be
    // configured by the server, although will default to one update per five minutes.
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { data, isLoading, mutate } = useSWR<DisplayDefinition['response']>(url, fetcher, {
        refreshInterval: data => !!data ? data.config.updateFrequencyMs : kDefaultUpdateFrequencyMs,
    });

    // ---------------------------------------------------------------------------------------------
    // Apply settings based of the `data`, to be updated whenever the state changes:
    // ---------------------------------------------------------------------------------------------

    useEffect(() => {
        if (!data)
            return;

        markUpdateCompleted();

        // Apply any time offset that the server indicates this device should be subject to.
        setTimeOffset(data.config.timeOffset);

        // Automatically update the device's colour when the server indicated that this should
        // change. This can be done programmatically, or be hardcoded in configuration.
        if (data.device.color !== getColorValue()) {
            const [ red, green, blue ] = decomposeColor(data.device.color);

            device.setLightColour(red, green, blue);
            setColorValue(data.device.color);
        }

        // Automatically lock (or unlock) the device based on the received `context`. No
        // feedback is given, other than the "lock" icon shown in the overflow menu.
        if (data.device.locked !== isLockedValue()) {
            data.device.locked ? device.enableKiosk()
                               : device.disableKiosk();

            setLockedValue(data.device.locked);
        }

    }, [ data ]);

    // ---------------------------------------------------------------------------------------------

    // Requests for the schedule to be refreshed. Will resolve without value when successful, or
    // throw an exception when the update could not be processed. Wrapped to avoid leaking internals
    const handleRefresh = useCallback(async () => {
        await mutate();

    }, [ mutate ]);

    // ---------------------------------------------------------------------------------------------

    const context: DisplayContextInfo = useMemo(() => {
        return {
            context: data,
            isLoading,
            refresh: handleRefresh,
        };
    }, [ data, handleRefresh, isLoading ]);

    return (
        <DisplayTheme>
            <DisplayContext.Provider value={context}>
                {props.children}
            </DisplayContext.Provider>
        </DisplayTheme>
    );
}
