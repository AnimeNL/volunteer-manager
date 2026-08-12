// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationContextWithEvent } from '../../../../requireAuthenticationContextWithEvent';

/**
 * Page that displays an individual purchase for a particular event and ticket type. While there is
 * no strong technical reason to require the ticket type check, it helps with sensible hierarchy.
 */
export default async function EventTicketsVisitorPurchasePage(
    props: PageProps<'/admin/events/[event]/tickets/visitors/[type]/[id]'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
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

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> }
                     title={service.formatPurchaseId(purchase.id)}
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
            <Section noHeader tabs>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Purchase REF' },
                             { param: 'type', prefix: 'Ticket #' }, 'Visitors', 'Tickets',
                             { event: 'event' });