// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { LineChartPro } from '@mui/x-charts-premium';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { IntegrationLogTarget } from '@lib/database/Types';
import type { ServerAction } from '@lib/serverAction';
import { formatDate } from '@lib/Temporal';

/**
 * Height of the performance graph, in pixels.
 */
const kGraphHeightPx = 320;

/**
 * Single data point representing an individual integration call.
 */
export interface IntegrationPerformancePoint {
    /**
     * Timestamp of the call in epoch milliseconds.
     */
    timestamp: number;

    /**
     * Time to first byte (TTFB), in milliseconds, when recorded.
     */
    ttfbMs: number | null;

    /**
     * Total response time, in milliseconds, when recorded.
     */
    durationMs: number | null;
}

/**
 * Unique `{log_integration, log_operation}` pair that can be selected.
 */
export interface IntegrationOperationPair {
    integration: IntegrationLogTarget;
    operation: string;
}

/**
 * Props accepted by the <IntegrationPerformanceGraph> component.
 */
interface IntegrationPerformanceGraphProps {
    /**
     * Server Action used to fetch performance data for a selected pair.
     */
    action: ServerAction<IntegrationOperationPair>;

    /**
     * Unique `{log_integration, log_operation}` pairs available in the database.
     */
    operations: IntegrationOperationPair[];
}

/**
 * Encodes an `{integration, operation}` pair into a single string key for `<Select>`.
 */
function encodePairKey(pair: IntegrationOperationPair): string {
    return `${pair.integration}:${pair.operation}`;
}

/**
 * Formats a millisecond duration value for display on axes and tooltips.
 */
function formatDurationMs(value: number | null): string {
    if (value === null)
        return 'N/A';

    return `${Math.round(value * 10) / 10} ms`;
}

/**
 * Interactive component that allows selecting a `{log_integration, log_operation}` pair and
 * displays a line graph mapping TTFB and total response times over the past three months.
 */
export function IntegrationPerformanceGraph(props: IntegrationPerformanceGraphProps) {
    const [ selectedKey, setSelectedKey ] = useState<string>(() =>
        props.operations.length > 0 ? encodePairKey(props.operations[0]) : '');

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(props.operations.length > 0);
    const [ points, setPoints ] = useState<IntegrationPerformancePoint[]>([ /* empty */ ]);

    const selectedPair = useMemo(() => {
        return props.operations.find(pair => encodePairKey(pair) === selectedKey);
    }, [ props.operations, selectedKey ]);

    const handleSelectionChange = useCallback((event: SelectChangeEvent<string>) => {
        setSelectedKey(event.target.value);
    }, [ /* no dependencies */ ]);

    useEffect(() => {
        if (!selectedPair)
            return;

        let cancelled = false;

        async function fetchPoints(pair: IntegrationOperationPair) {
            setError(undefined);
            setLoading(true);

            try {
                const response = await props.action(pair);
                if (cancelled)
                    return;

                if (!response.success) {
                    setError(response.error ?? 'Unable to load integration performance data.');
                    setPoints([ /* empty */ ]);
                } else {
                    setPoints(response.points);
                }
            } catch ( caughtError: any ) {
                if (!cancelled) {
                    setError(caughtError?.message ?? 'Unable to load integration performance data.');
                    setPoints([ /* empty */ ]);
                }
            } finally {
                if (!cancelled)
                    setLoading(false);
            }
        }

        fetchPoints(selectedPair);

        return () => {
            cancelled = true;
        };
    }, [ props.action, selectedPair ]);

    const { timestamps, ttfbData, durationData } = useMemo(() => {
        const timestamps: Date[] = [];
        const ttfbData: (number | null)[] = [];
        const durationData: (number | null)[] = [];

        for (const point of points) {
            timestamps.push(new Date(point.timestamp));
            ttfbData.push(point.ttfbMs);
            durationData.push(point.durationMs);
        }

        return { timestamps, ttfbData, durationData };
    }, [ points ]);

    if (!props.operations.length) {
        return (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                No integration calls have been recorded yet.
            </Typography>
        );
    }

    return (
        <Stack spacing={2}>
            <FormControl size="small" fullWidth>
                <InputLabel id="integration-operation-select-label">
                    Integration operation
                </InputLabel>
                <Select labelId="integration-operation-select-label"
                        label="Integration operation"
                        value={selectedKey}
                        onChange={handleSelectionChange}>
                    { props.operations.map(pair => {
                        const key = encodePairKey(pair);
                        return (
                            <MenuItem key={key} value={key}>
                                {pair.integration}: {pair.operation}
                            </MenuItem>
                        );
                    }) }
                </Select>
            </FormControl>

            { !!loading &&
                <Stack sx={{ height: kGraphHeightPx, justifyContent: 'center' }} spacing={1}>
                    <Skeleton animation="wave" height={12} width="95%" />
                    <Skeleton animation="wave" height={12} width="92%" />
                    <Skeleton animation="wave" height={12} width="100%" />
                    <Skeleton animation="wave" height={12} width="98%" />
                    <Skeleton animation="wave" height={12} width="88%" />
                    <Skeleton animation="wave" height={12} width="95%" />
                </Stack> }

            { (!loading && !!error) &&
                <Alert severity="error">
                    {error}
                </Alert> }

            { (!loading && !error && !points.length) &&
                <Alert severity="info">
                    No timing data has been recorded for this operation in the past three months.
                </Alert> }

            { (!loading && !error && !!points.length) &&
                <LineChartPro
                    height={kGraphHeightPx}
                    grid={{ horizontal: true }}
                    margin={{ top: 10, right: 24, bottom: 0, left: 0 }}
                    zoomInteractionConfig={{
                        zoom: [ 'brush', 'doubleTapReset' ],
                        pan: [ /* disabled */ ],
                    }}
                    xAxis={[
                        {
                            data: timestamps,
                            scaleType: 'time',
                            zoom: true,
                            valueFormatter: (value: Date | number, context) => {
                                if (context.location === 'tick')
                                    return context.defaultTickLabel;

                                const instant =
                                    Temporal.Instant.fromEpochMilliseconds(value.valueOf());

                                return formatDate(
                                    instant.toZonedDateTimeISO(Temporal.Now.timeZoneId()),
                                    'YYYY-MM-DD HH:mm:ss');
                            },
                        },
                    ]}
                    yAxis={[
                        {
                            min: 0,
                            position: 'left',
                            width: 75,
                            valueFormatter: (value: number) => `${Math.round(value)} ms`,
                        },
                    ]}
                    series={[
                        {
                            id: 'ttfb',
                            label: 'TTFB',
                            color: '#4E79A7',
                            data: ttfbData,
                            showMark: points.length <= 50,
                            valueFormatter: formatDurationMs,
                        },
                        {
                            id: 'duration',
                            label: 'Response time',
                            color: '#F28E2C',
                            data: durationData,
                            showMark: points.length <= 50,
                            valueFormatter: formatDurationMs,
                        },
                    ]} /> }
        </Stack>
    );
}
