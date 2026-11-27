// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import type { OverviewTileId } from './components/OverviewTiles';
import type { OverviewVendorEntry } from './components/OverviewVendorCard';
import { EventBanner } from './components/EventBanner';
import { OverviewTiles } from './components/OverviewTiles';
import { OverviewVendorCard } from './components/OverviewVendorCard';
import { Page, SuspenseReveal } from './components/Page';
import { getActiveVendors, hasVendorSchedule } from './lib/data/vendorData';
import { getVolunteerHotelBookings } from './lib/data/hotelData';
import { getVolunteerTicket } from './lib/data/ticketData';
import { readCachedSetting, readSettings } from '@lib/Settings';
import { readUserSettings } from '@lib/UserSettings';
import { requireScheduleAccess } from './lib/getScheduleAccess';

import { kAnyTeam } from '@lib/auth/access';
import { kVendorTeam } from '@lib/database/Types';

/**
 * Authenticates the overview request behind `<Suspense>` and renders the volunteer's actionable
 * CTA tiles.
 */
async function OverviewActions(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);

    const [ hotelBookings, scannerEnabled, ticket, userSettings ] = await Promise.all([
        getVolunteerHotelBookings(event, user.id),
        readCachedSetting('schedule-enable-scanner', false),
        getVolunteerTicket(event, user.id),
        readUserSettings(user.id, [
            'user-schedule-hide-hotel-tile',
            'user-schedule-hide-ticket-tile',
        ], /* disableFallback= */ true),
    ]);

    const tiles: OverviewTileId[] = [];
    if (!!ticket && !userSettings['user-schedule-hide-ticket-tile'])
        tiles.push('ticket');
    if (hotelBookings.length > 0 && !userSettings['user-schedule-hide-hotel-tile'])
        tiles.push('hotel');

    tiles.push('schedule');
    if (scannerEnabled)
        tiles.push('scanner');

    tiles.push('feedback');

    return <OverviewTiles eventSlug={event.slug} tiles={tiles} />;
}

/**
 * Skeleton placeholder matching the responsive Bento action tile layout while data streams.
 */
function OverviewActionsSkeleton() {
    return (
        <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: 5 }}>
                <Skeleton variant="rounded" height={80} />
            </Grid>
            <Grid container spacing={1.25} size={{ xs: 12, md: 7 }}>
                <Grid size="grow">
                    <Skeleton variant="rounded" height={80} />
                </Grid>
                <Grid size="grow">
                    <Skeleton variant="rounded" height={80} />
                </Grid>
                <Grid size="grow">
                    <Skeleton variant="rounded" height={80} />
                </Grid>
            </Grid>
        </Grid>
    );
}

/**
 * Authenticates the overview request behind `<Suspense>` and renders the unified on-site First Aid
 * and Security card based on portal settings and `volunteers.vendor-teams` access.
 */
async function OverviewVendors(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { access, currentTime, event } = await requireScheduleAccess(eventSlug);

    const fullVendorAccess = access.can('volunteers.vendor-teams', 'read', {
        event: event.slug,
        team: kAnyTeam,
    });

    const settings = await readSettings([
        'schedule-vendor-first-aid-card',
        'schedule-vendor-security-card',
    ]);

    const showFirstAid = fullVendorAccess || !!settings['schedule-vendor-first-aid-card'];
    const showSecurity = fullVendorAccess || !!settings['schedule-vendor-security-card'];

    if (!showFirstAid && !showSecurity)
        return null;

    const [ firstAidNames, firstAidScheduled, securityNames, securityScheduled ] =
        await Promise.all([
            showFirstAid ? getActiveVendors(event, kVendorTeam.FirstAid, currentTime) : undefined,
            showFirstAid && fullVendorAccess
                ? hasVendorSchedule(event, kVendorTeam.FirstAid)
                : false,
            showSecurity ? getActiveVendors(event, kVendorTeam.Security, currentTime) : undefined,
            showSecurity && fullVendorAccess
                ? hasVendorSchedule(event, kVendorTeam.Security)
                : false,
        ]);

    const entries: OverviewVendorEntry[] = [];
    if (firstAidNames !== undefined) {
        entries.push({
            clickable: firstAidScheduled,
            names: firstAidNames,
            team: kVendorTeam.FirstAid,
        });
    }
    if (securityNames !== undefined) {
        entries.push({
            clickable: securityScheduled,
            names: securityNames,
            team: kVendorTeam.Security,
        });
    }

    return <OverviewVendorCard entries={entries} eventSlug={event.slug} />;
}

/**
 * Skeleton placeholder matching the unified two-row on-site vendor card while data streams.
 */
function OverviewVendorsSkeleton() {
    const row = (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, py: 1.25 }}>
            <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: '10px' }} />
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                <Skeleton variant="text" width={72} height={18} />
                <Skeleton variant="text" width={136} height={18} />
            </Box>
        </Stack>
    );

    return (
        <Card>
            {row}
            <Divider />
            {row}
        </Card>
    );
}

/**
 * Overview landing page for the event schedule portal.
 */
export default function ScheduleLandingPage(props: PageProps<'/schedule2/[event]'>) {
    return (
        <Page>
            <EventBanner params={props.params} variant="widescreen" />
            <SuspenseReveal fallback={ <OverviewActionsSkeleton /> }>
                <OverviewActions params={props.params} />
            </SuspenseReveal>
            <SuspenseReveal fallback={ <OverviewVendorsSkeleton /> }>
                <OverviewVendors params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
