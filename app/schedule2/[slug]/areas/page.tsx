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
import { getProgramAreas } from '../lib/scheduleData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Fallback skeleton displayed in the App Shell while convention areas stream in.
 */
function AreasSkeleton() {
    return (
        <Card>
            <CardContent>
                <Skeleton variant="text" width="35%" height={28} />
                <Skeleton variant="text" width="80%" height={24} sx={{ mt: 1 }} />
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="70%" height={24} />
            </CardContent>
        </Card>
    );
}

/**
 * Streams the event's real program areas and live active event counts behind `<Suspense>`.
 */
async function AreasContent(props: Pick<PageProps<'/schedule2/[slug]/areas'>, 'params'>) {
    const { slug } = await props.params;
    const { currentTime, event } = await requireScheduleAccess(slug);

    const festivalId = event.integrations?.anPlanFestivalId;
    const areas = festivalId ? await getProgramAreas(festivalId) : [];
    const currentMs = currentTime.epochMilliseconds;

    return (
        <Card>
            <CardContent>
                <Stack direction="row"
                       sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="h6">
                        Events by area
                    </Typography>
                    <Typography variant="body2">
                        <Link href={`/schedule2/${event.slug}`} transitionTypes={[ 'nav-back' ]}
                              style={{ color: 'inherit' }}>
                            ← Overview
                        </Link>
                    </Typography>
                </Stack>

                { areas.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No program areas are available for {event.shortName} yet.
                    </Typography>
                ) : (
                    <Stack divider={ <Divider /> } spacing={1.5}>
                        { areas.map(area => {
                            const activeCount = area.timeslots.reduce(
                                (count, slot) => count + (
                                    slot.startEpochMs <= currentMs && slot.endEpochMs > currentMs
                                        ? 1
                                        : 0),
                                0);

                            return (
                                <Stack key={area.id} direction="row" spacing={2}
                                       sx={{
                                           alignItems: 'center',
                                           justifyContent: 'space-between',
                                       }}>
                                    <div>
                                        <Typography variant="subtitle1">
                                            {area.name}
                                        </Typography>
                                        <Typography variant="body2"
                                                    sx={{ color: 'text.secondary' }}>
                                            {area.locations.map(l => l.name).join(' · ')}
                                        </Typography>
                                    </div>
                                    { activeCount > 0 &&
                                        <Chip color="error" label={`${activeCount} active`}
                                              size="small" /> }
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
 * Program areas page for `app/schedule2/[slug]/areas`.
 */
export default function Schedule2AreasPage(props: PageProps<'/schedule2/[slug]/areas'>) {
    return (
        <PageTransition>
            <SetTitle title="Events" />
            <Suspense
                fallback={
                    <ViewTransition exit="schedule2-slide-down" default="none">
                        <AreasSkeleton />
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule2-slide-up" default="none">
                    <AreasContent params={props.params} />
                </ViewTransition>
            </Suspense>
        </PageTransition>
    );
}

export const instant = true;
export const prefetch = 'partial';
