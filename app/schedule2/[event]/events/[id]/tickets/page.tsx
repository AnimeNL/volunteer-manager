// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { Header } from '../../../components/Header';
import { Page, SuspenseReveal } from '../../../components/Page';
import { requireScheduleAccess } from '../../../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>` and verifies `event.tickets` read access.
 */
async function EventTicketsPlaceholderContent(
    props: { params: Promise<{ event: string; id: string }> })
{
    const { event: eventSlug } = await props.params;
    const { access, event } = await requireScheduleAccess(eventSlug);
    if (!access.can('event.tickets', 'read', { event: event.slug }))
        forbidden();

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Event tickets
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    Not yet implemented.
                </Typography>
            </CardContent>
        </Card>
    );
}

/**
 * Placeholder ticket holders and check-in page for a program event.
 */
export default function ScheduleEventTicketsPage(
    props: PageProps<'/schedule2/[event]/events/[id]/tickets'>)
{
    return (
        <Page
            header={
                <Header
                    description="Ticket holders and check-in for this program event."
                    icon={ <ConfirmationNumberOutlinedIcon /> }
                    title="Event tickets" />
            }>
            <SuspenseReveal
                fallback={
                    <Card>
                        <CardContent>
                            <Skeleton variant="text" width="35%" height={28} />
                            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                        </CardContent>
                    </Card>
                }>
                <EventTicketsPlaceholderContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
