// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { EventBanner } from './components/EventBanner';
import { OverviewActionTiles } from './components/OverviewActionTiles';
import { Page, SuspenseReveal } from './components/Page';
import { getVolunteerHotelBookings } from './lib/data/hotelData';
import { getVolunteerTicket } from './lib/data/ticketData';
import { readUserSettings } from '@lib/UserSettings';
import { requireScheduleAccess } from './lib/getScheduleAccess';

/**
 * Authenticates the overview request behind `<Suspense>` and renders the volunteer's actionable
 * CTA tiles.
 */
async function OverviewActions(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);

    const [ hotelBookings, ticket, userSettings ] = await Promise.all([
        getVolunteerHotelBookings(event, user.id),
        getVolunteerTicket(event, user.id),
        readUserSettings(user.id, [
            'user-schedule-hide-feedback-tile',
            'user-schedule-hide-hotel-tile',
            'user-schedule-hide-schedule-tile',
            'user-schedule-hide-ticket-tile',
        ], /* disableFallback= */ true),
    ]);

    return (
        <OverviewActionTiles
            eventSlug={event.slug}
            showFeedback={!userSettings['user-schedule-hide-feedback-tile']}
            showHotel={hotelBookings.length > 0 && !userSettings['user-schedule-hide-hotel-tile']}
            showSchedule={!userSettings['user-schedule-hide-schedule-tile']}
            showTicket={!!ticket && !userSettings['user-schedule-hide-ticket-tile']} />
    );
}

/**
 * Skeleton placeholder matching the responsive Bento action tile layout while data streams.
 */
function OverviewActionsSkeleton() {
    return (
        <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: 5 }}>
                <Skeleton variant="rounded" sx={{ height: { xs: 68, md: 80 } }} />
            </Grid>
            <Grid container spacing={1.25} size={{ xs: 12, md: 7 }}>
                <Grid size="grow">
                    <Skeleton variant="rounded" sx={{ height: { xs: 78, md: 80 } }} />
                </Grid>
                <Grid size="grow">
                    <Skeleton variant="rounded" sx={{ height: { xs: 78, md: 80 } }} />
                </Grid>
                <Grid size="grow">
                    <Skeleton variant="rounded" sx={{ height: { xs: 78, md: 80 } }} />
                </Grid>
            </Grid>
        </Grid>
    );
}

/**
 * Temporary placeholder card while the remaining overview sections are being built out.
 */
async function OverviewPlaceholder(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {event.shortName}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    Not yet implemented.
                </Typography>
            </CardContent>
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
            <SuspenseReveal
                fallback={
                    <Card>
                        <CardContent>
                            <Skeleton variant="text" width="35%" height={28} />
                            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                        </CardContent>
                    </Card>
                }>
                <OverviewPlaceholder params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
