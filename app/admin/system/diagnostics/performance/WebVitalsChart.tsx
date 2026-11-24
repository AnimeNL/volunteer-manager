// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { LineChartPro } from '@mui/x-charts-premium';

import type { WebVitalMetric } from '@lib/database/Types';

/**
 * Single time-series measurement returned by the route performance Server Action.
 */
export interface WebVitalSeriesPoint {
    timestamp: number;
    metric: WebVitalMetric;
    value: number;
    buildHash: string;
}

interface WebVitalsChartProps {
    mode: 'timing' | 'cls';
    points: WebVitalSeriesPoint[];
}

const kChartHeight = 300;

function formatMs(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)} ms`;
}

function formatCls(value: number | null): string {
    return value === null ? '—' : value.toFixed(3);
}

/**
 * Renders either the millisecond timing series (`TTFB`, `FCP`, `LCP`, `INP`) or the unitless `CLS`
 * series for the selected route.
 */
export function WebVitalsChart(props: WebVitalsChartProps) {
    const { mode, points } = props;

    const chartData = useMemo(() => {
        const filtered = mode === 'cls'
            ? points.filter(point => point.metric === 'CLS')
            : points.filter(point => point.metric !== 'CLS');

        const timestamps: Date[] = [];
        const ttfb: (number | null)[] = [];
        const fcp: (number | null)[] = [];
        const lcp: (number | null)[] = [];
        const inp: (number | null)[] = [];
        const cls: (number | null)[] = [];

        for (const point of filtered) {
            timestamps.push(new Date(point.timestamp));
            ttfb.push(point.metric === 'TTFB' ? point.value : null);
            fcp.push(point.metric === 'FCP' ? point.value : null);
            lcp.push(point.metric === 'LCP' ? point.value : null);
            inp.push(point.metric === 'INP' ? point.value : null);
            cls.push(point.metric === 'CLS' ? point.value : null);
        }

        return { timestamps, ttfb, fcp, lcp, inp, cls, count: filtered.length };
    }, [ mode, points ]);

    const showMark = chartData.count <= 60;

    const series = mode === 'cls'
        ? [
              {
                  id: 'cls',
                  label: 'CLS',
                  color: '#9C27B0',
                  data: chartData.cls,
                  connectNulls: true,
                  showMark,
                  valueFormatter: formatCls,
              },
          ]
        : [
              {
                  id: 'ttfb',
                  label: 'TTFB',
                  color: '#4E79A7',
                  data: chartData.ttfb,
                  connectNulls: true,
                  showMark,
                  valueFormatter: formatMs,
              },
              {
                  id: 'fcp',
                  label: 'FCP',
                  color: '#59A14F',
                  data: chartData.fcp,
                  connectNulls: true,
                  showMark,
                  valueFormatter: formatMs,
              },
              {
                  id: 'lcp',
                  label: 'LCP',
                  color: '#F28E2C',
                  data: chartData.lcp,
                  connectNulls: true,
                  showMark,
                  valueFormatter: formatMs,
              },
              {
                  id: 'inp',
                  label: 'INP',
                  color: '#E15759',
                  data: chartData.inp,
                  connectNulls: true,
                  showMark,
                  valueFormatter: formatMs,
              },
          ];

    return (
        <LineChartPro
            height={kChartHeight}
            grid={{ horizontal: true }}
            xAxis={[
                {
                    data: chartData.timestamps,
                    scaleType: 'time',
                    zoom: true,
                },
            ]}
            yAxis={[
                {
                    min: 0,
                    valueFormatter: (value: number) =>
                        mode === 'cls' ? value.toFixed(2) : `${Math.round(value)} ms`,
                },
            ]}
            series={series} />
    );
}
