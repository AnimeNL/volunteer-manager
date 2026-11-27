// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cacheLife } from 'next/cache';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EmptyStateCard } from '../components/EmptyStateCard';
import { Header } from '../components/Header';
import { MonospaceText } from '../components/MonospaceText';
import { Page, SuspenseReveal } from '../components/Page';
import { QrCode } from '@components/QrCode';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';
import { getVolunteerTicket } from '../lib/data/ticketData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Privately cached per-session ticket renderer for `eventSlug`, allowing per-link prefetching to
 * resolve the volunteer's ticket ahead of navigation.
 */
async function CachedTicketContent(props: { eventSlug: string }) {
    'use cache: private';
    cacheLife({ stale: 60 });

    const { event, user } = await requireScheduleAccess(props.eventSlug);
    const ticket = await getVolunteerTicket(event, user.id);

    if (!ticket) {
        return (
            <EmptyStateCard
                description={
                    `No ticket has been issued to your account for ${event.shortName} yet.`
                }
                noCard
                title="No ticket available" />
        );
    }

    return (
        <CardContent>
            <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ alignSelf: 'stretch' }}>
                    We can't wait to see you! Feel free to skip the queues when you arrive and head
                    straight to the Registration Desk. Just ask a Steward if you need any help.
                </Typography>
                <QrCode content={ticket.barcode} framed sx={{ maxWidth: 400, width: '80%' }} />
                <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                    <MonospaceText color="textSecondary">
                        {ticket.barcode}
                    </MonospaceText>
                    <MonospaceText color="textSecondary">
                        Order: {ticket.orderNumber}
                    </MonospaceText>
                </Stack>
            </Stack>
        </CardContent>
    );
}

/**
 * Authenticates the request behind `<Suspense>` and renders the volunteer's ticket QR code.
 */
async function TicketContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    return <CachedTicketContent eventSlug={eventSlug} />;
}

/**
 * Skeleton placeholder shown while the volunteer's ticket barcode is streaming.
 */
function TicketSkeleton() {
    return (
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
            <Stack spacing={0.5} sx={{ alignSelf: 'stretch' }}>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="75%" />
            </Stack>
            <Box sx={{ maxWidth: 400, width: '80%' }}>
                <Skeleton variant="rounded" sx={{
                    aspectRatio: '1',
                    borderRadius: 1,
                    height: 'auto',
                    width: '100%',
                }} />
            </Box>
            <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                <Skeleton variant="text" width={200} />
                <Skeleton variant="text" width={130} />
            </Stack>
        </Stack>
    );
}

/**
 * Your ticket page for the schedule portal, displaying a scannable QR code for the signed-in
 * volunteer's festival ticket.
 */
export default function ScheduleTicketPage(props: PageProps<'/schedule2/[event]/ticket'>) {
    return (
        <Page
            header={
                <Header
                    description="Welcoming you to the festival"
                    icon={ <ConfirmationNumberOutlinedIcon /> }
                    title="Your ticket" />
            }>
            <Card>
                <SuspenseReveal
                    fallback={
                        <CardContent>
                            <TicketSkeleton />
                        </CardContent>
                    }>
                    <TicketContent params={props.params} />
                </SuspenseReveal>
            </Card>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Your ticket', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
