// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatDate } from '@lib/Temporal';
import { getEvent } from '@lib/cache';

import { kSheetBorderRadiusPx } from '../Constants';

/**
 * Props accepted by the <EventBanner> component.
 */
interface EventBannerProps {
    /**
     * Route params promise from the `[event]` segment, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;

    /**
     * Layout variant: `sidebar` renders a fixed-height card for desktop navigation; `widescreen`
     * renders a mobile-only widescreen banner for the overview page.
     */
    variant: 'sidebar' | 'widescreen';
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
 * banner stays decoupled from the static App Shell.
 */
async function EventBannerImage(props: EventBannerProps) {
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
    const isWidescreen = props.variant === 'widescreen';

    return (
        <>
            <Box component="img" alt={title} src={imageUrl}
                 sx={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }} />
            <Box aria-hidden="true" sx={{
                background: isWidescreen
                    ? 'linear-gradient(180deg, transparent 30%, ' +
                      'rgba(0, 0, 0, 0.52) 72%, rgba(0, 0, 0, 0.82) 100%)'
                    : 'linear-gradient(180deg, transparent 25%, ' +
                      'rgba(0, 0, 0, 0.52) 65%, rgba(0, 0, 0, 0.88) 100%)',
                inset: 0,
                pointerEvents: 'none',
                position: 'absolute',
                ...(isWidescreen && {
                    '.dark &': {
                        background:
                            'linear-gradient(180deg, transparent 20%, ' +
                            'color-mix(in srgb, var(--mui-palette-m3-sheet) 58%, transparent) ' +
                            '66%, var(--mui-palette-m3-sheet) 100%)',
                    },
                }),
            }} />
            <Stack spacing={0.25} sx={{
                bottom: 0,
                left: 0,
                pointerEvents: 'none',
                position: 'absolute',
                px: isWidescreen ? 2 : 1.5,
                py: isWidescreen ? 1.5 : 1.25,
                right: 0,
            }}>
                <Typography noWrap sx={{
                    color: '#ffffff',
                    fontSize: isWidescreen ? '1.2rem' : '0.875rem',
                    fontWeight: isWidescreen ? 700 : 600,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.85), 0 0 8px rgba(0, 0, 0, 0.45)',
                }}>
                    {title}
                </Typography>
                { !!subtitle &&
                    <Typography noWrap sx={{
                        color: 'rgba(255, 255, 255, 0.82)',
                        fontSize: isWidescreen ? '0.8rem' : '0.72rem',
                        lineHeight: 1.3,
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.75)',
                    }}>
                        {subtitle}
                    </Typography> }
            </Stack>
        </>
    );
}

/**
 * Displays the event's banner image with a bottom gradient scrim, title, and date/venue subtitle.
 * Streams event metadata behind `<Suspense>` to keep the surrounding shell static.
 */
export function EventBanner(props: EventBannerProps) {
    return (
        <Card sx={props.variant === 'widescreen'
            ? {
                aspectRatio: '22 / 9',
                borderRadius: `${kSheetBorderRadiusPx}px ${kSheetBorderRadiusPx}px 0 0`,
                display: { xs: 'block', md: 'none' },
                mt: -1.5,
                mx: -1.5,
                position: 'relative',
            }
            : { height: 112, position: 'relative' }}>
            <Suspense
                fallback={ <Skeleton variant="rectangular" width="100%" height="100%" /> }>
                <EventBannerImage params={props.params} variant={props.variant} />
            </Suspense>
        </Card>
    );
}
