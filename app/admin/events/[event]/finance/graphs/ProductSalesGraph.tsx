// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useId, useState } from 'react';

import type { AllSeriesType } from '@mui/x-charts-pro';
import { BarPlot, ChartContainerPro, ChartsAxisHighlight, ChartsClipPath, ChartsGrid, ChartsReferenceLine, ChartsTooltip,
    ChartsXAxis, ChartsYAxis, LinePlot } from '@mui/x-charts-pro';

import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { type ProductSalesResult, fetchProductSales } from './ProductSalesGraphFn';

/**
 * Default height of graphs. Width will be based on the container.
 */
const kDefaultGraphHeightPx = 275;

/**
 * Props accepted by the <ProductSalesGraph> component.
 */
interface ProductSalesGraphProps {
    /**
     * Unique ID of the event for which the graph should be displayed.
     */
    eventId: number;

    /**
     * Height of the graph, in pixels. Width will be based on the container.
     * @default kDefaultGraphHeightPx
     */
    height?: number;

    /**
     * Unique IDs of the products that should be included in this sales graph.
     */
    products: number[];
}

/**
 * The <ProductSalesGraph> graph displays a line graph, containing one line per product, visualising
 * sales of a product group over the course of convention organisation.
 */
export function ProductSalesGraph(props: ProductSalesGraphProps) {
    const chartId = useId();

    const [ error, setError ] = useState<string | undefined>();
    const [ result, setResult ] = useState<ProductSalesResult | undefined>();
    const [ series, setSeries ] = useState<AllSeriesType[] | undefined>();

    useEffect(() => {
        const fetchProductSalesFromServer = async () => {
            const response = await fetchProductSales(props.eventId, props.products);
            if (!response.success) {
                setError(response.error);
                return;
            }

            const series: AllSeriesType[] = [];
            for (const serie of response.data.series) {
                series.push({
                    ...serie,
                    valueFormatter: (value: unknown) => {
                        if (serie.type === 'bar')
                            return null;  // hide day-individual sale values

                        return value === null ? value : `${value}`;
                    },
                });
            }

            setResult(response.data);
            setSeries(series);
        };

        fetchProductSalesFromServer();

    }, [ props.eventId, props.products ]);

    if (!result) {
        return (
            <Stack sx={{ height: props.height || kDefaultGraphHeightPx }} justifyContent="center">
                { !!error &&
                    <Alert severity="error">
                        {error}
                    </Alert> }
                { !error &&
                    <>
                        <Skeleton animation="wave" height={10} width="95%" />
                        <Skeleton animation="wave" height={10} width="92%" />
                        <Skeleton animation="wave" height={10} width="100%" />
                        <Skeleton animation="wave" height={10} width="98%" />
                        <Skeleton animation="wave" height={10} width="88%" />
                        <Skeleton animation="wave" height={10} width="95%" />
                    </> }
            </Stack>
        );
    }

    return (
        <ChartContainerPro series={series} height={props.height ?? kDefaultGraphHeightPx}
                           xAxis={[ result.xAxis ]} yAxis={result.yAxis}
                           margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
            <g clipPath={`url(#${chartId}-clip-path)`}>
                <BarPlot />
                <LinePlot />
                { result.referenceLines.map((line, index) =>
                    <ChartsReferenceLine key={index} {...line} />) }
            </g>
            <ChartsAxisHighlight x="line" />
            <ChartsClipPath id={`${chartId}-clip-path`} />
            <ChartsGrid horizontal />
            <ChartsTooltip />
            <ChartsXAxis />
            { result.yAxis.map(axis => <ChartsYAxis key={axis.id} axisId={axis.id} />) }
        </ChartContainerPro>
    );
}
