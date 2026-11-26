// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { EventBanner } from './components/EventBanner';
import { OverviewActionTiles } from './components/OverviewActionTiles';
import { Page, SuspenseReveal } from './components/Page';
import { getVolunteerTicket } from './lib/data/ticketData';
import { requireScheduleAccess } from './lib/getScheduleAccess';

/**
 * Authenticates the overview request behind `<Suspense>` and renders the volunteer's actionable
 * CTA tiles.
 */
async function OverviewActions(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const ticket = await getVolunteerTicket(event, user.id);

    return <OverviewActionTiles eventSlug={event.slug} hasTicket={!!ticket} />;
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
            <SuspenseReveal fallback={ <Skeleton variant="rounded" height={68} /> }>
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
