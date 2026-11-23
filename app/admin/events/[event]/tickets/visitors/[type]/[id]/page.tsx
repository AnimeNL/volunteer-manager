// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Box from '@mui/material/Box';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import Paper from '@mui/material/Paper';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { PurchaseIdLink } from '../../../PurchaseIdLink';
import { QrCode } from '@components/QrCode';
import { Section } from '@app/admin/components/Section';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/auth';

import { kEventTicketCategory } from '@lib/database/Types';

/**
 * Ticket categories that represent primary visitor/volunteer admission tickets.
 */
const kDisplayedTicketCategories = new Set<string>([
    kEventTicketCategory.Event,
    kEventTicketCategory.TicketFriday,
    kEventTicketCategory.TicketSaturday,
    kEventTicketCategory.TicketSunday,
    kEventTicketCategory.TicketVolunteers,
    kEventTicketCategory.TicketWeekend,
]);

/**
 * Page that displays an individual purchase for a particular event and ticket type. While there is
 * no strong technical reason to require the ticket type check, it helps with sensible hierarchy.
 */
export default async function EventTicketsVisitorPurchasePage(
    props: PageProps<'/admin/events/[event]/tickets/visitors/[type]/[id]'>)
{
    const { event } = await requireAuthenticationWithEvent(props, {
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

    const purchaseLink = service.createPurchaseLink(purchase.id);

    const configurations = await service.listTicketConfigurations(event.id);

    const ticketTypeIds = new Set<string>();
    for (const config of configurations) {
        if (config.category && kDisplayedTicketCategories.has(config.category))
            ticketTypeIds.add(String(config.ticketTypeId));
    }

    const displayedTickets = purchase.tickets.filter(
        ticket => ticketTypeIds.has(ticket.ticketId.toString()));

    const additionalProducts = purchase.tickets.filter(
        ticket => !ticketTypeIds.has(ticket.ticketId.toString()));

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
                            <PurchaseIdLink href={purchaseLink} label={purchase.id} />
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
                { displayedTickets.map(ticket =>
                    <Grid key={ticket.id} size={{ xs: 12, md: 6, lg: 4 }}>
                        <Paper sx={{ p: 1.5, pb: ticket.barcode ? 0 : 1.5 }}>
                            <SectionHeader icon={ <ConfirmationNumberOutlinedIcon /> }
                                           title={`Ticket ${service.formatTicketId(ticket.id)}`}
                                           sx={{ pb: 1.5 }} />
                            <Stack direction="column" spacing={0.5}>
                                { !!ticket.ticketName &&
                                    <Typography variant="subtitle2" noWrap>
                                        {ticket.ticketName}
                                    </Typography> }
                                { !!ticket.holder &&
                                    <Typography variant="body2" noWrap>
                                        {ticket.holder}
                                    </Typography>}
                                { !!ticket.nickname &&
                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        <strong>Nickname</strong>: {ticket.nickname}
                                    </Typography> }
                                { !!ticket.barcode &&
                                    <Box sx={{ pt: 1 }}>
                                        <QrCode content={ticket.barcode} />
                                    </Box> }
                            </Stack>
                        </Paper>
                    </Grid> ) }
            </Grid>
            { additionalProducts.length > 0 &&
                <Section icon={ <ShoppingBagOutlinedIcon color="primary" /> }
                         title="Additional products">
                    <KeyValueList items={additionalProducts.map(product => ({
                        key: product.ticketName ||
                            `Product ${service.formatTicketId(product.id)}`,
                        value: product.holder
                            ? `${product.id} (${product.holder})`
                            : String(product.id),
                    }))} />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Purchase #' },
                             { param: 'type', prefix: 'Ticket #' }, 'Visitors', 'Tickets',
                             { event: 'event' });
