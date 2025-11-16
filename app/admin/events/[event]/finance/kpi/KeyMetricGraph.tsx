// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { BarPlot, ChartContainerPro, ChartsAxisHighlight, ChartsAxisTooltipContent,
    ChartsTooltipContainer, useAxesTooltip, type BarSeriesType }
    from '@components/proxy/mui-x-charts-pro';

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatMetric } from './ValueFormatter';

/**
 * Props accepted by the <KeyMetricGraph> component.
 */
interface KeyMetricGraphProps {
    /**
     * Labels that indicate the values represented on each slice of the bar graph.
     */
    labels: string[];

    /**
     * Series that should be displayed on the graph.
     */
    series: BarSeriesType[];

    /**
     * Type of data that is being presented by this graph.
     */
    type: 'revenue' | 'sales';
}

/**
 * The <KeyMetricGraph> component displays a horizontal bar graph visualising revenue or sales in
 * the past period. Each bar can be hovered over to provide more detailed data about a certain day
 * of sales, optionally grouped by sale category.
 */
export function KeyMetricGraph(props: KeyMetricGraphProps) {
    const series = useMemo(() => {
        return props.series.map(series => ({
            valueFormatter: (value: number | null) => formatMetric(value ?? 0, props.type),
            ...series,
        }));

    }, [ props.series, props.type ]);

    return (
        <ChartContainerPro height={100} series={series}
                           margin={{
                               top: 8,
                               right: 0,
                               bottom: 0,
                               left: 0,
                           }}
                           yAxis={[ { domainLimit: 'strict', position: 'none' } ]}
                           xAxis={[
                               {
                                   data: props.labels,
                                   position: 'none',
                                   scaleType: 'band',
                               }
                           ]}>
            <BarPlot />
            <ChartsAxisHighlight x="band" />
            <ChartsTooltipContainer>
                <ChartsAxisTooltipContent sx={{
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                }} />
                <ChartsAxisTooltipTotals type={props.type} />
            </ChartsTooltipContainer>
        </ChartContainerPro>
    );
}

/**
 * The <ChartAxisTooltipTotals> component computes the total across all series in case there are
 * multiple, to conveniently visualise combined revenue or sales information.
 */
function ChartsAxisTooltipTotals(props: { type: KeyMetricGraphProps['type'] }) {
    const tooltipData = useAxesTooltip();
    if (!tooltipData)
        return null;  // no tooltip is being rendered

    let totalValue = 0;
    let totalSeries = 0;

    for (const { seriesItems } of tooltipData) {
        totalSeries += seriesItems.length;
        for (const { value } of seriesItems) {
            if (typeof value === 'number')
                totalValue += value;
        }
    }

    if (totalSeries < 2)
        return null;  // there is nothing to add up

    return (
        <Paper variant="outlined" sx={{
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            marginTop: '-1px',
        }}>
            <Stack direction="row" justifyContent="space-between" sx={{ px: 1.5, py: 0.75 }}>
                <Typography>
                    Total
                </Typography>
                <Typography sx={{ fontWeight: '500' }}>
                    { formatMetric(totalValue, props.type) }
                </Typography>
            </Stack>
        </Paper>
    );
}
