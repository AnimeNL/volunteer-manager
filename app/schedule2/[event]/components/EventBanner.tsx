// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { BannerHeading, BannerScrim, BannerSubtitle } from './EventBannerChrome';
import { formatDate } from '@lib/Temporal';
import { getEvent } from '@lib/cache';

import { kSheetBorderRadiusPx } from '../Constants';

/**
 * Props accepted by the <SidebarEventBanner> and <MobileEventBanner> components.
 */
interface EventBannerProps {
    /**
     * Route params promise from the `[event]` segment, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;
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
 * Resolves the banner image URL, title, and date/venue subtitle for the `[event]` segment.
 */
async function loadEventBanner(params: Promise<{ event: string }>) {
    const { event: eventSlug } = await params;
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

    return {
        imageUrl,
        subtitle: subtitleParts.join(' · '),
        title,
    };
}

/**
 * Renders the cover-fitted event banner image inside its `<Card>` container.
 */
function BannerImage(props: { alt: string; src: string }) {
    return (
        <Box component="img" alt={props.alt} src={props.src}
             sx={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }} />
    );
}

/**
 * Streams sidebar event banner metadata behind `<Suspense>` with a dark bottom gradient scrim.
 */
async function SidebarEventBannerContent(props: EventBannerProps) {
    const { imageUrl, subtitle, title } = await loadEventBanner(props.params);

    return (
        <>
            <BannerImage alt={title} src={imageUrl} />
            <BannerScrim aria-hidden="true" surface="dark" />
            <Stack spacing={0.25} sx={{
                bottom: 0,
                left: 0,
                pointerEvents: 'none',
                position: 'absolute',
                px: 1.5,
                py: 1.25,
                right: 0,
            }}>
                <BannerHeading noWrap surface="dark" variant="subtitle2">
                    {title}
                </BannerHeading>
                { !!subtitle &&
                    <BannerSubtitle noWrap surface="dark" variant="caption">
                        {subtitle}
                    </BannerSubtitle> }
            </Stack>
        </>
    );
}

/**
 * Streams mobile overview banner metadata behind `<Suspense>`, fading into the `m3.sheet` surface.
 */
async function MobileEventBannerContent(props: EventBannerProps) {
    const { imageUrl, subtitle, title } = await loadEventBanner(props.params);

    return (
        <>
            <BannerImage alt={title} src={imageUrl} />
            <BannerScrim aria-hidden="true" surface="sheet" />
            <Stack spacing={0.25} sx={{
                bottom: 0,
                left: 0,
                pointerEvents: 'none',
                position: 'absolute',
                px: 2,
                py: 1.5,
                right: 0,
            }}>
                <BannerHeading noWrap surface="sheet" variant="h6">
                    {title}
                </BannerHeading>
                { !!subtitle &&
                    <BannerSubtitle noWrap surface="sheet" variant="body2">
                        {subtitle}
                    </BannerSubtitle> }
            </Stack>
        </>
    );
}

/**
 * Fixed-height sidebar event banner for the desktop navigation rail. Streams event metadata
 * behind `<Suspense>` to keep the surrounding shell static.
 */
export function SidebarEventBanner(props: EventBannerProps) {
    return (
        <Card sx={{ height: 112, position: 'relative' }}>
            <Suspense
                fallback={ <Skeleton variant="rectangular" width="100%" height="100%" /> }>
                <SidebarEventBannerContent params={props.params} />
            </Suspense>
        </Card>
    );
}

/**
 * Mobile-only widescreen event banner rendered flush at the top of the overview sheet. Streams
 * event metadata behind `<Suspense>` to keep the surrounding shell static.
 */
export function MobileEventBanner(props: EventBannerProps) {
    return (
        <Card sx={{
            aspectRatio: '22 / 9',
            borderRadius: `${kSheetBorderRadiusPx}px ${kSheetBorderRadiusPx}px 0 0`,
            display: { xs: 'block', md: 'none' },
            flexShrink: 0,
            position: 'relative',
        }}>
            <Suspense
                fallback={ <Skeleton variant="rectangular" width="100%" height="100%" /> }>
                <MobileEventBannerContent params={props.params} />
            </Suspense>
        </Card>
    );
}
