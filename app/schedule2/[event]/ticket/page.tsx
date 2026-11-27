// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { QrCode } from '@components/QrCode';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';
import { getVolunteerTicket } from '../lib/data/ticketData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>` and renders the volunteer's ticket QR code.
 */
async function TicketContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const ticket = await getVolunteerTicket(event, user.id);

    if (!ticket) {
        return (
            <>
                <Typography variant="h6" gutterBottom>
                    No ticket available
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    No ticket has been issued to your account for {event.shortName} yet.
                </Typography>
            </>
        );
    }

    return (
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ alignSelf: 'stretch' }}>
                We can't wait to see you! Feel free to skip the queues when you arrive and head
                straight to the Registration Desk. Just ask a Steward if you need any help.
            </Typography>
            <QrCode content={ticket.barcode} framed sx={{ maxWidth: 400, width: '80%' }} />
            <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                <Typography color="textSecondary" variant="body2" sx={{
                    fontFamily: 'monospace',
                    letterSpacing: 1,
                }}>
                    {ticket.barcode}
                </Typography>
                <Typography color="textSecondary" variant="body2" sx={{
                    fontFamily: 'monospace',
                    letterSpacing: 1,
                }}>
                    Order: {ticket.orderNumber}
                </Typography>
            </Stack>
        </Stack>
    );
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
                <CardContent>
                    <SuspenseReveal fallback={ <TicketSkeleton /> }>
                        <TicketContent params={props.params} />
                    </SuspenseReveal>
                </CardContent>
            </Card>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Your ticket', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
