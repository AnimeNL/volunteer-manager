// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { LineChart, type LineChartProps } from './LineChartProxy';

/**
 * Props accepted by the <LineGraphClient> component.
 */
type LineGraphClientProps = LineChartProps & {
    /**
     * Whether the values (0-1) should be formatted as percentages.
     */
    percentage?: boolean;

    /**
     * Suffix for the values to display in the tooltips.
     */
    suffix?: string;
};

/**
 * The <LineGraphClient> component is the client-side version of the regular <LineGraph> component,
 * inserted as we need additional programmatic flexibility in configuring what the graph should be
 * displayed as - for example to format values for the tooltip.
 */
export function LineGraphClient(props: LineGraphClientProps) {
    const { percentage, series, suffix, ...rest } = props;

    const seriesMutated = useMemo(() => {
        if (percentage || suffix) {
            return series.map(serie => ({
                ...serie,
                valueFormatter: (v: any) => {
                    if (percentage) {
                        if (!v)
                            return '0%';

                        return `${Math.round(v * 100 * 10) / 10}%`;

                    } else if (suffix) {
                        if (!v)
                            return `0 ${suffix}`;

                        return `${Math.round(v * 10) / 10} ${suffix}`;

                    } else {
                        throw new Error('Value formatter is not sure what to do');
                    }
                },
            }));
        }

        return series;

    }, [ percentage, series, suffix ]);

    return (
        <LineChart {...rest} series={seriesMutated} />
    );
}
