// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ChartContainerProProps, ChartsReferenceLineProps, XAxis, YAxis }
    from '@mui/x-charts-pro';

/**
 * This is the Tableau 10 colour scheme, which looks good for these graphs.
 */
export const kRemoteGraphColorScheme = [
    '#4E79A7',
    '#F28E2C',
    '#E15759',
    '#76B7B2',
    '#59A14F',
    '#EDC949',
    '#AF7AA1',
    '#FF9DA7',
    '#9C755F',
    '#BAB0AB',
];

/**
 * Colour in which the line visualising an upper limit should be displayed.
 */
export const kRemoteGraphLimitColour = '#C62828';

/**
 * Result returned from the `fetchProductSales` server action when executed successfully.
 */
export interface RemoteGraphFnResult {
    /**
     * Zero or more reference lines that should be shown on the graph.
     */
    referenceLines: ChartsReferenceLineProps[];

    /**
     * Series and raw information that should be displayed on the graph.
     */
    series: NonNullable<ChartContainerProProps['series']>;

    /**
     * Singular x axis that should be displayed on the graph.
     */
    xAxis: XAxis;

    /**
     * Zero, one or two y axes that should be displayed on the graph.
     */
    yAxis: YAxis[];
}

/**
 * Data that should be retrieved by a function implementing remote graph data fetching.
 */
export type RemoteGraphFnReturn = {
    success: false;
    error: string;
} | {
    success: true;
    data: RemoteGraphFnResult;
};

/**
 * Type defining the server action function used to handle remote graph data fetching.
 */
export type RemoteGraphFn = () => Promise<RemoteGraphFnReturn>;

/**
 * Computes the |labels| to identify as ticks on the horizontal axis, when a total of |amount| are
 * to be displayed. The first and last are guaranteed to be included.
 */
export function computeTickInterval(labels: string[], amount: number = 6) {
    let tickInterval: string[] | undefined;

    if (labels.length >= amount) {
        const increment = (labels.length - 1) / (amount - 1);

        tickInterval = [ /* to be populated */ ];
        for (let tick = 0; tick < amount; ++tick)
            tickInterval.push(labels[Math.round(tick * increment)]);
    }

    return tickInterval;
}
