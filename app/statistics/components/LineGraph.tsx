// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import type { LineChartProps } from './LineChartProxy';
import Skeleton from '@mui/material/Skeleton';

import type { Filters } from '../Filters';
import { LineGraphClient } from './LineGraphClient';

/**
 * Data that's intended to be displayed in a line graph. Will be fetched asynchronously.
 */
export interface LineGraphData {
    /**
     * The data set that should be displayed on the graph.
     */
    dataset?: LineChartProps['dataset'];

    /**
     * Data series that should be displayed on the graph.
     */
    series: LineChartProps['series'];

    /**
     * X-axis information to show on the graph.
     */
    xAxis: LineChartProps['xAxis'];
}

/**
 * Props accepted by the <LineGraph> component.
 */
interface LineGraphProps {
    /**
     * Filters that should be honoured for this graph.
     */
    filters: Filters;

    /**
     * Whether the values (0-1) should be formatted as percentages.
     */
    percentage?: boolean;

    /**
     * Suffix for the values to display in the tooltips.
     */
    suffix?: string;

    /**
     * Query that should be executed in order to compute this graph's data.
     */
    query: (filters: Filters) => Promise<LineGraphData>;
}

/**
 * The <LineGraphImpl> component is the implementation of the <LineGraph> without the React suspense
 * boundary, i.e. the function that's expected to fetch and display the required data.
 */
async function LineGraphImpl(props: LineGraphProps) {
    const data = await props.query(props.filters);

    return <LineGraphClient {...data}
                            grid={{ horizontal: true }}
                            margin={{ left: 0, right: 16, top: 24, bottom: 8 }} hideLegend
                            height={200} percentage={props.percentage} suffix={props.suffix} />;
}

/**
 * The <LineGraph> component displays a line graph. The data will be fetched asynchronously, with a
 * React suspense boundary in between to enable fetching to happen in parallel.
 */
export async function LineGraph(props: LineGraphProps) {
    return (
        <Suspense fallback={
            <>
                <Skeleton animation="wave" variant="rounded" height={174} sx={{ mb: .25 }} />
                <Skeleton animation="wave" height={12} width="100%" />
                <Skeleton animation="wave" height={12} width="97%" />
            </> }>
            <LineGraphImpl {...props} />
        </Suspense>
    );
}
