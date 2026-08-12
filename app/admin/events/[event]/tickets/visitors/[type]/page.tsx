// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationContextWithEvent } from '../../../requireAuthenticationContextWithEvent';

/**
 * Page that displays the tickets that were sold for a particular ticket type. The data table makes
 * it possible to quickly search by name or ticket ID.
 */
export default async function EventTicketsVisitorTicketTypePage(
    props: PageProps<'/admin/events/[event]/tickets/visitors/[type]'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const { type } = await props.params;

    const service = await createTicketService(event.slug);
    const tickets = await service?.listTicketTypes();

    const ticket = tickets?.find(ticket => ticket.id.toString() === type);
    if (!ticket)
        notFound();

    return (
        <>
            <Section icon={ <ConfirmationNumberOutlinedIcon color="primary" /> }
                     title={ticket.name}
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Visitors', href: `/admin/events/${event.slug}/tickets/visitors` },
                        {
                            label: ticket.name,
                        }
                     ]}>
                <SectionIntroduction>
                    Overview of the all tickets of this type purchased for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'type', prefix: 'Ticket #' }, 'Visitors', 'Tickets',
                             { event: 'event' });
