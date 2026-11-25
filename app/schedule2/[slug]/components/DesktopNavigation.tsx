// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

import { DesktopNavigationList, VolunteerNavigationItems } from './DesktopNavigationList';
import { getEvent } from '@lib/cache';
import { getScheduleAccess } from '../lib/getScheduleAccess';
import { getUserEventShifts } from '../lib/scheduleData';

import { kDesktopMenuWidthPx } from '../Constants';

/**
 * Props accepted by the <DesktopNavigation> component.
 */
interface DesktopNavigationProps {
    /**
     * Route params promise from the `[slug]` layout, awaited inside `<Suspense>`.
     */
    params: Promise<{ slug: string }>;
}

/**
 * Streams the event's identity image from `getEvent()` inside `<Suspense>` so the sidebar header
 * stays decoupled from the static App Shell.
 */
async function EventBannerImage(props: DesktopNavigationProps) {
    const { slug } = await props.params;
    const event = await getEvent(slug);
    const imageUrl = event?.imageUrl ?? '/images/admin/event-header.jpg';

    return (
        <Box component="img" alt={event?.name ?? 'AnimeCon'} src={imageUrl}
             sx={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }} />
    );
}

/**
 * Streams volunteer-specific sidebar items behind `<Suspense>`. Returns null when the visitor is
 * not signed in or lacks access to this event's schedule portal.
 */
async function AuthenticatedNavigationItems(props: DesktopNavigationProps) {
    const { slug } = await props.params;
    const access = await getScheduleAccess(slug);
    if (!access)
        return null;

    const shifts = await getUserEventShifts(access.event.id, access.user.id);
    const currentMs = access.currentTime.epochMilliseconds;
    const hasActiveShift = shifts.some(
        shift => shift.startEpochMs <= currentMs && shift.endEpochMs > currentMs);

    return (
        <VolunteerNavigationItems hasActiveShift={hasActiveShift}
                                  hasShifts={shifts.length > 0}
                                  slug={access.event.slug} />
    );
}

/**
 * Desktop sidebar navigation for the `app/schedule2/` App Shell.
 */
export function DesktopNavigation(props: DesktopNavigationProps) {
    return (
        <>
            <Box sx={{
                bgcolor: 'background.paper',
                borderRadius: 1,
                height: kDesktopMenuWidthPx / 2,
                mb: 0.75,
                ml: 2,
                mt: 2,
                overflow: 'hidden',
                width: kDesktopMenuWidthPx - 32,
            }}>
                <Suspense fallback={ <Skeleton variant="rectangular" width="100%" height="100%" /> }>
                    <EventBannerImage params={props.params} />
                </Suspense>
            </Box>
            <DesktopNavigationList>
                <Suspense fallback={null}>
                    <AuthenticatedNavigationItems params={props.params} />
                </Suspense>
            </DesktopNavigationList>
        </>
    );
}
