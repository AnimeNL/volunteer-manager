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
import { formatDate } from '@lib/Temporal';
import { getUserEventShifts } from '../lib/scheduleData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

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
 * Classifies a shift relative to `currentMs`.
 */
function getShiftStatus(
    startEpochMs: number, endEpochMs: number, currentMs: number): 'active' | 'past' | 'upcoming'
{
    if (endEpochMs <= currentMs)
        return 'past';
    if (startEpochMs <= currentMs)
        return 'active';

    return 'upcoming';
}

/**
 * Streams the authenticated volunteer's real shifts behind `<Suspense>`.
 */
async function ShiftsContent(props: Pick<PageProps<'/schedule2/[event]/shifts'>, 'params'>) {
    const { event: eventSlug } = await props.params;
    const { currentTime, event, user } = await requireScheduleAccess(eventSlug);

    const shifts = await getUserEventShifts(event.id, user.id);
    const currentMs = currentTime.epochMilliseconds;

    return (
        <Card>
            <CardContent>
                <Stack direction="row"
                       sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="h6">
                        Your schedule
                    </Typography>
                    <Typography variant="body2">
                        <Link href={`/schedule2/${event.slug}`} transitionTypes={[ 'nav-back' ]}
                              style={{ color: 'inherit' }}>
                            ← Overview
                        </Link>
                    </Typography>
                </Stack>

                { shifts.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        You currently have no scheduled shifts for {event.shortName}.
                    </Typography>
                ) : (
                    <Stack divider={ <Divider /> } spacing={1.5}>
                        { shifts.map(shift => {
                            const status = getShiftStatus(
                                shift.startEpochMs, shift.endEpochMs, currentMs);
                            const start = Temporal.Instant.fromEpochMilliseconds(shift.startEpochMs)
                                .toZonedDateTimeISO(event.timeZone);
                            const end = Temporal.Instant.fromEpochMilliseconds(shift.endEpochMs)
                                .toZonedDateTimeISO(event.timeZone);

                            return (
                                <Stack key={shift.id} direction="row" spacing={1.5}
                                       sx={{
                                           alignItems: 'center',
                                           justifyContent: 'space-between',
                                           opacity: status === 'past' ? 0.6 : 1,
                                       }}>
                                    <div>
                                        <Typography variant="subtitle1">
                                            {shift.title}
                                        </Typography>
                                        <Typography variant="body2"
                                                    sx={{ color: 'text.secondary' }}>
                                            {formatDate(start, 'dddd')} ·{' '}
                                            {formatDate(start, 'HH:mm')} –{' '}
                                            {formatDate(end, 'HH:mm')} · {shift.location}
                                        </Typography>
                                    </div>
                                    <Chip label={status} size="small"
                                          color={status === 'active' ? 'success' : 'default'} />
                                </Stack>
                            );
                        }) }
                    </Stack>
                ) }
            </CardContent>
        </Card>
    );
}

/**
 * Volunteer shifts page for `app/schedule2/[event]/shifts`.
 */
export default function Schedule2ShiftsPage(props: PageProps<'/schedule2/[event]/shifts'>) {
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
