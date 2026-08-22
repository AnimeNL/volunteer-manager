// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { QrCode } from '@components/QrCode';
import { Section } from '@app/admin/components/Section';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Page that displays an individual purchase for a particular event and ticket type. While there is
 * no strong technical reason to require the ticket type check, it helps with sensible hierarchy.
 */
export default async function EventTicketsVisitorPurchasePage(
    props: PageProps<'/admin/events/[event]/tickets/visitors/[type]/[id]'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const { type, id: purchaseId } = await props.params;

    const service = await createTicketService(event.slug);
    const tickets = await service?.listTicketTypes();

    const ticket = tickets?.find(ticket => ticket.id.toString() === type);
    if (!ticket || !service)
        notFound();

    const purchase = await service.fetchPurchase(purchaseId);

    const relevantTicket = purchase?.tickets.find(ticket => ticket.ticketId.toString() === type);
    if (!relevantTicket || !purchase)
        notFound();

    const purchaseLink = service.createPurchaseLink(purchase.id) || '#';

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> }
                     title={service.formatPurchaseId(purchase.id)} documentation="event/tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Visitors', href: `/admin/events/${event.slug}/tickets/visitors` },
                        {
                            label: ticket.name,
                            href: `/admin/events/${event.slug}/tickets/visitors/${ticket.id}`,
                        },
                        {
                            label: service.formatPurchaseId(purchase.id)
                        }
                     ]}>
                <SectionIntroduction>
                    One of the (hopefully many) purchases made for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back tabs>
                <KeyValueList items={[
                    {
                        key: 'Purchase ID',
                        valueTemplate: 'component',
                        value: (
                            <Typography variant="body2">
                                { service.formatPurchaseId(purchase.id) }
                                <MuiLink component={Link} href={purchaseLink} target="_blank">
                                    <OpenInNewIcon fontSize="inherit" sx={{
                                        position: 'relative',
                                        left: '6px',
                                        top: '2px',
                                    }} />
                                </MuiLink>
                            </Typography>
                        ),
                    },
                    {
                        key: 'Event ID',
                        value: purchase.eventId,
                    },
                    {
                        condition: !!purchase.paid,
                        key: 'Paid',
                        valueTemplate: 'localDateTime',
                        value: purchase.paid?.toString(),
                    },
                    {
                        condition: !!purchase.cancelled,
                        key: 'Cancelled',
                        valueTemplate: 'localDateTime',
                        value: purchase.cancelled?.toString(),
                    }
                ]} />
            </Section>
            <Grid container spacing={1.5}>
                { service.id === 'YourTicketProvider' && purchase.tickets.map(ticket =>
                    <Grid key={ticket.id} size={{ xs: 12, md: 6, lg: 4 }}>
                        <Paper sx={{ p: 1.5, pb: 0 }}>
                            <SectionHeader icon={ <ConfirmationNumberOutlinedIcon /> }
                                           title={`Ticket ${ticket.id}`} sx={{ pb: 1.5 }} />
                            <Stack direction="column" spacing={0.5}>
                                { !!ticket.ticketName &&
                                    <Typography variant="subtitle2" noWrap>
                                        {ticket.ticketName}
                                    </Typography> }
                                { !!ticket.holder &&
                                    <Typography variant="body2" noWrap>
                                        {ticket.holder}
                                    </Typography>}
                                { !!ticket.barcode &&
                                    <Box sx={{ pt: 1 }}>
                                        <QrCode content={ticket.barcode} />
                                    </Box> }
                            </Stack>
                        </Paper>
                    </Grid> ) }
            </Grid>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Purchase REF' },
                             { param: 'type', prefix: 'Ticket #' }, 'Visitors', 'Tickets',
                             { event: 'event' });