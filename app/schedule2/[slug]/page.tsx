// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';
import { Suspense, ViewTransition } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PageTransition } from './components/PageTransition';
import { SetTitle } from './components/ScheduleTitle';
import { getMockEventSummary } from './lib/mockScheduleData';

/**
 * Fallback skeleton displayed in the static shell while dynamic event overview data streams in.
 */
function OverviewSkeleton() {
    return (
        <Stack spacing={2}>
            <Card>
                <CardContent>
                    <Skeleton variant="text" width="35%" height={20} />
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="50%" height={20} />
                </CardContent>
            </Card>
            <Card>
                <CardContent>
                    <Skeleton variant="text" width="35%" height={20} />
                    <Skeleton variant="text" width="55%" height={32} />
                    <Skeleton variant="text" width="45%" height={20} />
                </CardContent>
            </Card>
        </Stack>
    );
}

/**
 * Async Server Component that awaits `params` and reads cached mocked overview data inside
 * `<Suspense>` so the surrounding App Shell stays static and reusable across slugs.
 */
async function OverviewContent(props: Pick<PageProps<'/schedule2/[slug]'>, 'params'>) {
    const { slug } = await props.params;
    const summary = await getMockEventSummary(slug);

    return (
        <>
            <SetTitle title={summary.eventName} />
            <Link href={`/schedule2/${summary.slug}/shifts`} transitionTypes={[ 'nav-forward' ]}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                <Card sx={{ borderLeft: 4, borderColor: 'success.main' }}>
                    <CardContent>
                        <Typography sx={{ color: 'text.secondary', fontSize: 14 }} gutterBottom>
                            You&apos;re currently busy with… (mocked)
                        </Typography>
                        <Typography variant="h5">
                            {summary.activeShift.title}
                        </Typography>
                        <Typography variant="body2">
                            {summary.activeShift.location}, until {summary.activeShift.endTime}
                        </Typography>
                    </CardContent>
                </Card>
            </Link>
            <Link href={`/schedule2/${summary.slug}/areas`} transitionTypes={[ 'nav-forward' ]}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                <Card>
                    <CardContent>
                        <Typography sx={{ color: 'text.secondary', fontSize: 14 }} gutterBottom>
                            Up next… (mocked)
                        </Typography>
                        <Typography variant="h5">
                            {summary.upcomingShift.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {summary.upcomingShift.location}, starting at{' '}
                            {summary.upcomingShift.startTime} — click to browse event areas
                        </Typography>
                    </CardContent>
                </Card>
            </Link>
        </>
    );
}

/**
 * Mocked landing page for `app/schedule2/[slug]/`. Wraps the page in directional `<ViewTransition>`
 * boundaries and streams slug-dependent content behind `<Suspense>`.
 */
export default function Schedule2LandingPage(props: PageProps<'/schedule2/[slug]'>) {
    return (
        <PageTransition>
            <Suspense
                fallback={
                    <ViewTransition exit="schedule2-slide-down" default="none">
                        <OverviewSkeleton />
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule2-slide-up" default="none">
                    <OverviewContent params={props.params} />
                </ViewTransition>
            </Suspense>
        </PageTransition>
    );
}

export const instant = true;
export const prefetch = 'partial';
