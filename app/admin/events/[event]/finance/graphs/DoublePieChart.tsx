// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { PieChartPro, type PieChartProProps, type PieValueType } from '@components/proxy/mui-x-charts-pro';

/**
 * Props accepted by the <DoublePieChart> component.
 */
interface DoublePieChartProps {
    /**
     * Series that should be displayed on the <DoublePieChart> component.
     */
    series: {
        /**
         * Data associated with this serie.
         */
        data: PieValueType[];
    }[];
}

/**
 * The <DoublePieChart> component is a double pie chart with an inner and an outer layer. It's an
 * abstraction over MUI X's Pie Chat component, with our own composition.
 */
export function DoublePieChart(props: DoublePieChartProps) {
    const series = useMemo(() => {
        if (props.series.length !== 2)
            return [ /* invalid invariant */ ];

        const commonSeriesProperties: Omit<PieChartProProps['series'][number], 'data'> = {
            cornerRadius: 4,
            highlightScope: {
                fade: 'global',
                highlight: 'item',
            },
            faded: {
                additionalRadius: -10,
                color: 'gray',
            },
        };

        return [
            {
                ...commonSeriesProperties,
                innerRadius: '35%',
                outerRadius: '55%',
                data: props.series.pop()!.data,
            },
            {
                ...commonSeriesProperties,
                innerRadius: '60%',
                outerRadius: '90%',
                data: props.series.pop()!.data,
            }
        ] satisfies PieChartProProps['series'];
    }, [ props.series ]);

    return <PieChartPro hideLegend series={series} />;
}
