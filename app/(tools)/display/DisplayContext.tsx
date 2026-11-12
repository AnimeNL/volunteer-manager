// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext } from 'react';

import type { DisplayConfiguration, DisplayShiftInfo } from './DisplayActions';

export type { DisplayShiftInfo };

/**
 * Context conveyed for the entire display. The context is owned and maintained by the
 * <DisplayController> component, which also provides the necessary updates.
 */
export type DisplayContextInfo = {
    /**
     * The context received by the server.
     */
    context?: DisplayConfiguration;

    /**
     * Whether the display is currently loading.
     */
    isLoading?: boolean;

    /**
     * Refreshes the display. Will resolve peacefully when the update was successful, or reject with
     * an exception when the update could not be performed.
     */
    refresh?: () => Promise<void>;
};

/**
 * The <DisplayContext> carries information about the display's configuration.
 */
export const DisplayContext = createContext<DisplayContextInfo>({ /* default state */ });
