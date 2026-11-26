// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { EventBanner } from './components/EventBanner';
import { Page, SuspenseReveal } from './components/Page';
import { requireScheduleAccess } from './lib/getScheduleAccess';

/**
 * Authenticates the overview request behind `<Suspense>` and renders the temporary placeholder
 * card while overview sections are being built out.
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
