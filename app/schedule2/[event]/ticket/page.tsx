// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense, ViewTransition } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { QrCode } from '@components/QrCode';
import { SetTitle } from '../components/ScheduleTitle';
import { getEvent } from '@lib/cache';
import { getVolunteerTicket } from '../lib/data/ticketData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Streams the event-specific welcome description into the `<Header>` behind `<Suspense>`.
 */
async function TicketDescription(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const event = await getEvent(eventSlug);

    return `Welcoming you to ${event?.shortName}`;
}

/**
 * Authenticates the request behind `<Suspense>` and renders the volunteer's ticket QR code.
 */
async function TicketContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const ticket = await getVolunteerTicket(event, user.id);

    if (!ticket) {
        return (
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        No ticket available
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        No ticket has been issued to your account for {event.shortName} yet.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent>
                <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ alignSelf: 'stretch' }}>
                        We can't wait to see you! Feel free to skip the queues when you arrive and
                        head straight to the Registration Desk. Just ask a Steward if you need any
                        help.
                    </Typography>
                    <QrCode content={ticket.barcode} framed sx={{ maxWidth: 400, width: '80%' }} />
                    <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            letterSpacing: 1,
                        }}>
                            {ticket.barcode}
                        </Typography>
                        <Typography variant="body2" sx={{
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            letterSpacing: 1,
                        }}>
                            Order: {ticket.orderNumber}
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

/**
 * Skeleton placeholder shown while the volunteer's ticket barcode is streaming.
 */
function TicketSkeleton() {
    return (
        <Card>
            <CardContent>
                <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
                    <Stack spacing={0.5} sx={{ alignSelf: 'stretch' }}>
                        <Skeleton variant="text" width="100%" />
                        <Skeleton variant="text" width="75%" />
                    </Stack>
                    <Skeleton variant="rounded" sx={{
                        aspectRatio: '1',
                        height: 'auto',
                        maxWidth: 400,
                        width: '80%',
                    }} />
                    <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                        <Skeleton variant="text" width={140} />
                        <Skeleton variant="text" width={100} />
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
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
                    description={
                        <Suspense fallback={ <Skeleton variant="text" width={200} /> }>
                            <TicketDescription params={props.params} />
                        </Suspense>
                    }
                    icon={ <ConfirmationNumberOutlinedIcon /> }
                    title="Your ticket" />
            }>
            <SetTitle title="Your ticket" />
            <Suspense
                fallback={
                    <ViewTransition exit="schedule-slide-down" default="none">
                        <TicketSkeleton />
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule-slide-up" default="none">
                    <TicketContent params={props.params} />
                </ViewTransition>
            </Suspense>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
