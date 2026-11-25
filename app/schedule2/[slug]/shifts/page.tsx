// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';
import { Suspense, ViewTransition } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PageTransition } from '../components/PageTransition';
import { SetTitle } from '../components/ScheduleTitle';
import { getMockShifts } from '../lib/mockScheduleData';

/**
 * Fallback skeleton displayed in the App Shell while shift data streams in.
 */
function ShiftsSkeleton() {
    return (
        <Card>
            <CardContent>
                <Skeleton variant="text" width="40%" height={28} />
                <Skeleton variant="text" width="75%" height={24} sx={{ mt: 1 }} />
                <Skeleton variant="text" width="65%" height={24} />
                <Skeleton variant="text" width="70%" height={24} />
            </CardContent>
        </Card>
    );
}

/**
 * Streams mocked volunteer shift entries behind `<Suspense>`.
 */
async function ShiftsContent(props: Pick<PageProps<'/schedule2/[slug]/shifts'>, 'params'>) {
    const { slug } = await props.params;
    const shifts = await getMockShifts(slug);

    return (
        <Card>
            <CardContent>
                <Stack direction="row"
                       sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="h6">
                        Your schedule (mocked)
                    </Typography>
                    <Typography variant="body2">
                        <Link href={`/schedule2/${slug}`} transitionTypes={[ 'nav-back' ]}
                              style={{ color: 'inherit' }}>
                            ← Overview
                        </Link>
                    </Typography>
                </Stack>
                <Stack divider={ <Divider /> } spacing={1.5}>
                    { shifts.map(shift => (
                        <Stack key={shift.id} direction="row" spacing={2}
                               sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <Typography variant="subtitle1">
                                    {shift.title}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {shift.day} · {shift.timeRange} · {shift.location}
                                </Typography>
                            </div>
                            <Chip label={shift.status} size="small"
                                  color={shift.status === 'active' ? 'success' : 'default'} />
                        </Stack>
                    )) }
                </Stack>
            </CardContent>
        </Card>
    );
}

/**
 * Stub shifts page for verifying cross-route Instant Navigation and View Transitions.
 */
export default function Schedule2ShiftsPage(props: PageProps<'/schedule2/[slug]/shifts'>) {
    return (
        <PageTransition>
            <SetTitle title="Your schedule" />
            <Suspense
                fallback={
                    <ViewTransition exit="schedule2-slide-down" default="none">
                        <ShiftsSkeleton />
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule2-slide-up" default="none">
                    <ShiftsContent params={props.params} />
                </ViewTransition>
            </Suspense>
        </PageTransition>
    );
}

export const instant = true;
export const prefetch = 'partial';
