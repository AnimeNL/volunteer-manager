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
import { formatDate } from '@lib/Temporal';
import { getUserEventShifts } from './lib/scheduleData';
import { requireScheduleAccess } from './lib/getScheduleAccess';

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
 * Formats an epoch millisecond timestamp in the event's timezone.
 */
function formatEventTime(epochMs: number, timeZone: string, pattern: string): string {
    return formatDate(
        Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone),
        pattern);
}

/**
 * Async Server Component that authenticates, loads the volunteer's cached shifts, and renders live
 * active/upcoming shift overview cards behind `<Suspense>`.
 */
async function OverviewContent(props: Pick<PageProps<'/schedule2/[slug]'>, 'params'>) {
    const { slug } = await props.params;
    const { currentTime, event, user } = await requireScheduleAccess(slug);

    const shifts = await getUserEventShifts(event.id, user.id);
    const currentMs = currentTime.epochMilliseconds;

    const activeShift = shifts.find(
        shift => shift.startEpochMs <= currentMs && shift.endEpochMs > currentMs);
    const upcomingShift = shifts.find(shift => shift.startEpochMs > currentMs);

    return (
        <>
            <SetTitle title={event.shortName} />

            { activeShift &&
                <Link href={`/schedule2/${event.slug}/shifts`} transitionTypes={[ 'nav-forward' ]}
                      style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Card sx={{ borderLeft: 4, borderColor: 'success.main' }}>
                        <CardContent>
                            <Typography sx={{ color: 'text.secondary', fontSize: 14 }} gutterBottom>
                                You&apos;re currently busy with…
                            </Typography>
                            <Typography variant="h5">
                                {activeShift.title}
                            </Typography>
                            <Typography variant="body2">
                                {activeShift.location}, until{' '}
                                {formatEventTime(activeShift.endEpochMs, event.timeZone, 'HH:mm')}
                            </Typography>
                        </CardContent>
                    </Card>
                </Link> }

            { upcomingShift &&
                <Link href={`/schedule2/${event.slug}/shifts`} transitionTypes={[ 'nav-forward' ]}
                      style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Card>
                        <CardContent>
                            <Typography sx={{ color: 'text.secondary', fontSize: 14 }} gutterBottom>
                                Your next shift…
                            </Typography>
                            <Typography variant="h5">
                                {upcomingShift.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {upcomingShift.location},{' '}
                                {formatEventTime(
                                    upcomingShift.startEpochMs, event.timeZone, 'dddd HH:mm')}
                            </Typography>
                        </CardContent>
                    </Card>
                </Link> }

            { !activeShift && !upcomingShift &&
                <Card>
                    <CardContent>
                        <Typography sx={{ color: 'text.secondary', fontSize: 14 }} gutterBottom>
                            {event.shortName}
                        </Typography>
                        <Typography variant="h5">
                            { shifts.length > 0 ? 'All shifts completed!' : 'No shifts scheduled' }
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            { shifts.length > 0
                                ? 'Thank you for helping out during the festival.'
                                : 'You currently have no scheduled shifts for this event.' }
                        </Typography>
                    </CardContent>
                </Card> }

            <Link href={`/schedule2/${event.slug}/areas`} transitionTypes={[ 'nav-forward' ]}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                <Card>
                    <CardContent>
                        <Typography variant="subtitle1">
                            Browse festival program
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            View active events and locations by area
                        </Typography>
                    </CardContent>
                </Card>
            </Link>
        </>
    );
}

/**
 * Landing page for `app/schedule2/[slug]/`. Wraps the page in directional `<ViewTransition>`
 * boundaries and streams authenticated, event-specific overview cards behind `<Suspense>`.
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
