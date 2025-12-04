// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ChartContainerProProps, ChartsReferenceLineProps, XAxis, YAxis }
    from '@mui/x-charts-pro';

/**
 * This is the Tableau 10 colour scheme, which looks good for these graphs. Gemini extended this to
 * an unofficial "Tableau 50" color set allowing us to support additional products.
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

    // Unofficial additions:
    '#1F77B4',
    '#FF7F0E',
    '#2CA02C',
    '#D62728',
    '#9467BD',
    '#8C564B',
    '#E377C2',
    '#7F7F7F',
    '#BCBD22',
    '#17BECF',
    '#284766',
    '#A65628',
    '#8E2424',
    '#499894',
    '#2E5E2E',
    '#B6992D',
    '#6A3D9A',
    '#B35A66',
    '#5C4033',
    '#79706E',
    '#A0CBE8',
    '#FFBE7D',
    '#FF9D9A',
    '#86BCB6',
    '#8CD17D',
    '#F1CE63',
    '#D4A6C8',
    '#FABFD2',
    '#D7B5A6',
    '#D4D4D4',
    '#154F78',
    '#B0580A',
    '#1E6E1E',
    '#941B1C',
    '#664682',
    '#5E3C32',
    '#9E5386',
    '#525252',
    '#828218',
    '#108490',
];

/**
 * Colour in which the horizontal line visualising an upper limit should be displayed.
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
