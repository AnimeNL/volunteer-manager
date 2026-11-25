// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DesktopNavigationList, VolunteerNavigationItems } from './DesktopNavigationList';
import { formatDate } from '@lib/Temporal';
import { getEvent } from '@lib/cache';
import { getNavigationData } from '../lib/scheduleData';

/**
 * Props accepted by the <DesktopNavigation> component.
 */
interface DesktopNavigationProps {
    /**
     * Route params promise from the `[event]` layout, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;
}

/**
 * Sticky desktop sidebar navigation for the schedule App Shell, displaying the event banner above
 * the route-aware navigation list.
 */
export function DesktopNavigation(props: DesktopNavigationProps) {
    return (
        <Stack spacing={1.5} sx={{ position: 'sticky', top: 12 }}>
            <Card sx={{ height: 112, position: 'relative' }}>
                <Suspense
                    fallback={ <Skeleton variant="rectangular" width="100%" height="100%" /> }>
                    <EventBannerImage params={props.params} />
                </Suspense>
            </Card>
            <DesktopNavigationList>
                <Suspense fallback={null}>
                    <AuthenticatedNavigationItems params={props.params} />
                </Suspense>
            </DesktopNavigationList>
        </Stack>
    );
}

/**
 * Formats an event's start and end dates into a compact range in the event's local timezone
 * (e.g. "Jun 12–14", "May 30–Jun 1", or "Jun 12").
 */
function formatEventDateRange(
    startTime: Temporal.ZonedDateTime,
    endTime: Temporal.ZonedDateTime,
    timeZone: string,
): string {
    const start = startTime.withTimeZone(timeZone);
    const end = endTime.withTimeZone(timeZone);

    if (start.year === end.year && start.month === end.month) {
        if (start.day === end.day)
            return formatDate(start, 'MMM D');

        return `${formatDate(start, 'MMM D')}–${end.day}`;
    }

    return `${formatDate(start, 'MMM D')}–${formatDate(end, 'MMM D')}`;
}

/**
 * Streams the event's identity image and metadata from `getEvent()` inside `<Suspense>` so the
 * sidebar header stays decoupled from the static App Shell.
 */
async function EventBannerImage(props: DesktopNavigationProps) {
    const { event: eventSlug } = await props.params;
    const event = await getEvent(eventSlug);
    const imageUrl = event?.imageUrl ?? '/images/admin/event-header.jpg';
    const title = event?.shortName || event?.name || 'AnimeCon';

    const subtitleParts: string[] = [];
    if (event) {
        subtitleParts.push(formatEventDateRange(event.startTime, event.endTime, event.timeZone));

        const venue = event.location?.replace(/,.*$/, '').trim();
        if (venue)
            subtitleParts.push(venue);
    }

    const subtitle = subtitleParts.join(' · ');

    return (
        <>
            <Box component="img" alt={title} src={imageUrl}
                 sx={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }} />
            <Box aria-hidden="true" sx={{
                background:
                    'linear-gradient(180deg, transparent 25%, ' +
                    'rgba(0, 0, 0, 0.52) 65%, rgba(0, 0, 0, 0.88) 100%)',
                inset: 0,
                pointerEvents: 'none',
                position: 'absolute',
            }} />
            <Box sx={{
                bottom: 0,
                left: 0,
                pointerEvents: 'none',
                position: 'absolute',
                px: 1.5,
                py: 1.25,
                right: 0,
            }}>
                <Typography noWrap sx={{
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.85), 0 0 8px rgba(0, 0, 0, 0.45)',
                }}>
                    {title}
                </Typography>
                { !!subtitle &&
                    <Typography noWrap sx={{
                        color: 'rgba(255, 255, 255, 0.82)',
                        fontSize: '0.72rem',
                        lineHeight: 1.3,
                        mt: 0.25,
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.75)',
                    }}>
                        {subtitle}
                    </Typography> }
            </Box>
        </>
    );
}

/**
 * Streams volunteer-specific sidebar items behind `<Suspense>` using the shared request-cached
 * `getNavigationData()` loader.
 */
async function AuthenticatedNavigationItems(props: DesktopNavigationProps) {
    const { event } = await props.params;
    const data = await getNavigationData(event);

    return data ? <VolunteerNavigationItems data={data} /> : null;
}
