// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useEffect, useMemo, useState } from 'react';
import { useQueryState } from 'nuqs';

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { default as MuiLink } from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type { RouteVitalsSummary } from './computeVitalsSummary';
import type { ServerAction } from '@lib/serverAction';
import { WebVitalsChart, type WebVitalSeriesPoint } from './WebVitalsChart';

export type { WebVitalSeriesPoint };

type DeviceFilter = 'All' | 'Desktop' | 'Mobile';
type NavigationFilter = 'All' | 'Hard' | 'Soft';

interface WebVitalsDashboardProps {
    action: ServerAction<{
        route: string;
        deviceType: DeviceFilter;
        navigationScope: NavigationFilter;
    }>;
    reportingEnabled: boolean;
    routes: string[];
    summaries: RouteVitalsSummary[];
}

function formatTiming(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)} ms`;
}

function formatClsValue(value: number | null): string {
    return value === null ? '—' : value.toFixed(3);
}

/**
 * Interactive Web Vitals diagnostics dashboard allowing administrators to inspect per-route p75
 * summaries and drill into 3-month time-series charts filtered by device and navigation type.
 */
export function WebVitalsDashboard(props: WebVitalsDashboardProps) {
    const [ queryRoute, setQueryRoute ] = useQueryState('route');
    const [ deviceType, setDeviceType ] = useState<DeviceFilter>('All');
    const [ navigationScope, setNavigationScope ] = useState<NavigationFilter>('All');
    const [ chartMode, setChartMode ] = useState<'timing' | 'cls'>('timing');

    const [ loading, setLoading ] = useState<boolean>(props.routes.length > 0);
    const [ error, setError ] = useState<string | undefined>();
    const [ points, setPoints ] = useState<WebVitalSeriesPoint[]>([]);

    const selectedRoute = useMemo(() => {
        if (queryRoute && props.routes.includes(queryRoute))
            return queryRoute;

        return props.summaries[0]?.route ?? props.routes[0];
    }, [ props.routes, props.summaries, queryRoute ]);

    useEffect(() => {
        if (!selectedRoute)
            return;

        let active = true;
        setLoading(true);
        setError(undefined);

        props.action({ route: selectedRoute, deviceType, navigationScope })
            .then(response => {
                if (!active)
                    return;

                if (response.success) {
                    setPoints(response.points ?? []);
                } else {
                    setError(response.error ?? 'Unable to load Web Vitals data.');
                    setPoints([]);
                }
            })
            .catch((err: unknown) => {
                if (!active)
                    return;

                setError(err instanceof Error ? err.message : 'Unable to load Web Vitals data.');
                setPoints([]);
            })
            .finally(() => {
                if (active)
                    setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [ deviceType, navigationScope, props.action, selectedRoute ]);

    const buildHashes = useMemo(() => {
        const counts = new Map<string, number>();
        for (const point of points)
            counts.set(point.buildHash, (counts.get(point.buildHash) ?? 0) + 1);

        return [ ...counts.entries() ].slice(-6);
    }, [ points ]);

    return (
        <Stack spacing={2}>
            { !props.reportingEnabled &&
                <Alert severity="info">
                    Client-side Web Vitals reporting is currently disabled. Enable{' '}
                    <strong>Web Vitals reporting</strong> in{' '}
                    <MuiLink component={Link} href="/admin/system/settings">
                        System settings
                    </MuiLink>{' '}
                    to start collecting measurements.
                </Alert> }

            { !props.routes.length &&
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    No Web Vitals measurements have been recorded yet.
                </Typography> }

            { !!props.routes.length && (
                <>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel id="web-vitals-route-label">Route</InputLabel>
                            <Select labelId="web-vitals-route-label"
                                    label="Route"
                                    value={selectedRoute ?? ''}
                                    onChange={e => setQueryRoute(e.target.value)}>
                                { props.routes.map(route => (
                                    <MenuItem key={route} value={route}>
                                        {route}
                                    </MenuItem>
                                )) }
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel id="web-vitals-device-label">Device</InputLabel>
                            <Select labelId="web-vitals-device-label"
                                    label="Device"
                                    value={deviceType}
                                    onChange={e => setDeviceType(e.target.value as DeviceFilter)}>
                                <MenuItem value="All">All devices</MenuItem>
                                <MenuItem value="Desktop">Desktop</MenuItem>
                                <MenuItem value="Mobile">Mobile</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel id="web-vitals-nav-label">Navigation</InputLabel>
                            <Select labelId="web-vitals-nav-label"
                                    label="Navigation"
                                    value={navigationScope}
                                    onChange={e =>
                                        setNavigationScope(e.target.value as NavigationFilter) }>
                                <MenuItem value="All">All navigations</MenuItem>
                                <MenuItem value="Hard">Hard loads</MenuItem>
                                <MenuItem value="Soft">Soft navigations</MenuItem>
                            </Select>
                        </FormControl>

                        <ToggleButtonGroup size="small" exclusive value={chartMode}
                                           onChange={(_, val) => {
                                               if (val) setChartMode(val);
                                           }}>
                            <ToggleButton value="timing">Timings (ms)</ToggleButton>
                            <ToggleButton value="cls">CLS</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>

                    { loading && <Skeleton variant="rounded" height={300} /> }

                    { !loading && !!error && <Alert severity="error">{error}</Alert> }

                    { !loading && !error && !points.length &&
                        <Alert severity="info">
                            No measurements recorded for this route and filter combination.
                        </Alert> }

                    { !loading && !error && !!points.length && (
                        <>
                            <WebVitalsChart mode={chartMode} points={points} />
                            { !!buildHashes.length &&
                                <Stack direction="row" spacing={1} useFlexGap
                                       sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Builds in range:
                                    </Typography>
                                    { buildHashes.map(([ hash, count ]) => (
                                        <Chip key={hash} size="small" variant="outlined"
                                              label={`${hash} (${count})`} />
                                    )) }
                                </Stack> }
                        </>
                    ) }

                    { !!props.summaries.length && (
                        <>
                            <Typography variant="subtitle2" sx={{ pt: 1 }}>
                                Route overview (p75, last 30 days)
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Route</TableCell>
                                        <TableCell align="right">Samples</TableCell>
                                        <TableCell align="right">TTFB</TableCell>
                                        <TableCell align="right">FCP</TableCell>
                                        <TableCell align="right">LCP</TableCell>
                                        <TableCell align="right">INP</TableCell>
                                        <TableCell align="right">CLS</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    { props.summaries.map(row => (
                                        <TableRow key={row.route} hover
                                                  selected={row.route === selectedRoute}
                                                  onClick={() => setQueryRoute(row.route)}
                                                  sx={{ cursor: 'pointer' }}>
                                            <TableCell>{row.route}</TableCell>
                                            <TableCell align="right">{row.samples}</TableCell>
                                            <TableCell align="right">
                                                {formatTiming(row.ttfbP75)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatTiming(row.fcpP75)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatTiming(row.lcpP75)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatTiming(row.inpP75)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatClsValue(row.clsP75)}
                                            </TableCell>
                                        </TableRow>
                                    )) }
                                </TableBody>
                            </Table>
                        </>
                    ) }
                </>
            ) }
        </Stack>
    );
}
