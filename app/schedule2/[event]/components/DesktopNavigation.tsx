// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { DesktopNavigationList, VolunteerNavigationItems } from './DesktopNavigationList';
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
            <Card sx={{ height: 112 }}>
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
 * Streams the event's identity image from `getEvent()` inside `<Suspense>` so the sidebar header
 * stays decoupled from the static App Shell.
 */
async function EventBannerImage(props: DesktopNavigationProps) {
    const { event: eventSlug } = await props.params;
    const event = await getEvent(eventSlug);
    const imageUrl = event?.imageUrl ?? '/images/admin/event-header.jpg';

    return (
        <Box component="img" alt={event?.name ?? 'AnimeCon'} src={imageUrl}
             sx={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }} />
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
