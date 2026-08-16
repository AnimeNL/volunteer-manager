// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';

import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel,
    type Column, type ExtractRowModel } from '@app/admin/components/DataTable';
import { HolderCell, ValidityCell, ValidityHeaderCell } from '../../TicketCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@app/admin/lib/requireAuthentication';

/**
 * Data source for visitor tickets obtained from the ticketing provider for a specific type.
 */
const eventVisitorTicketsDataSource = createDataSource('event/tickets/visitors/type', withContext({
    /**
     * Event for which the tickets are being obtained.
     */
    event: kEventTransformer,

    /**
     * Ticket type for which tickets should be listed.
     */
    type: z.string(),

}), withRowModel({
    /**
     * Unique ID of the ticket.
     */
    id: z.string().or(z.number()),

    /**
     * Unique ID of the purchase that this ticket is part of.
     */
    purchaseId: z.string().or(z.number()),

    /**
     * Formatted unique ID of the purchase that this ticket is part of.
     */
    order: z.string(),

    /**
     * Name of the holder of the ticket, when known.
     */
    holder: z.string().optional(),

    /**
     * Date/time when the ticket was purchased.
     */
    purchased: z.string().optional(),

    /**
     * Whether the ticket has been cancelled.
     */
    cancelled: z.boolean(),

    /**
     * Whether the ticket was complimentary.
     */
    complimentary: z.boolean().optional(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.tickets',
            operation: 'read',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        const service = await createTicketService(context.event.slug);
        if (!service)
            return { rowCount: 0, rows: [] };

        const tickets = await service.listTicketsForType(context.type);

        const searchQuery = params.search?.toLocaleLowerCase();
        const filteredTickets = tickets.filter(ticket => {
            if (!searchQuery)
                return true;

            return String(ticket.id).toLocaleLowerCase().includes(searchQuery) ||
                   String(ticket.purchaseId).toLocaleLowerCase().includes(searchQuery) ||
                   ticket.holder?.toLocaleLowerCase().includes(searchQuery) ||
                   service.formatPurchaseId(ticket.purchaseId)
                       .toLocaleLowerCase().includes(searchQuery);
        });

        const sortedTickets = filteredTickets.sort((lhs, rhs) => {
            let comparison = 0;
            const field = params.sort.field;

            if (field === 'id') {
                comparison = String(lhs.id).localeCompare(String(rhs.id));
            } else if (field === 'order') {
                comparison = String(lhs.purchaseId).localeCompare(String(rhs.purchaseId));
            } else if (field === 'holder') {
                const lhsHolder = lhs.holder ?? '';
                const rhsHolder = rhs.holder ?? '';
                comparison = lhsHolder.localeCompare(rhsHolder);
            } else if (field === 'purchased') {
                const lhsPaid = lhs.paid ? lhs.paid.toString() : '';
                const rhsPaid = rhs.paid ? rhs.paid.toString() : '';
                comparison = lhsPaid.localeCompare(rhsPaid);
            } else if (field === 'cancelled') {
                const lhsCancelled = lhs.cancelled ? 1 : 0;
                const rhsCancelled = rhs.cancelled ? 1 : 0;
                comparison = lhsCancelled - rhsCancelled;
            }

            return params.sort.direction === 'asc' ? comparison : -comparison;
        });

        const selectedTickets = sortedTickets.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: sortedTickets.length,
            rows: selectedTickets.map(ticket => ({
                id: ticket.id,
                order: service.formatPurchaseId(ticket.purchaseId),
                purchaseId: ticket.purchaseId,
                holder: ticket.holder,
                purchased: ticket.paid?.toString(),
                cancelled: !!ticket.cancelled,
                complimentary: !!ticket.complimentary,
            })),
        };
    },
});

/**
 * Page that displays the tickets that were sold for a particular ticket type. The data table makes
 * it possible to quickly search by name or ticket ID.
 */
export default async function EventTicketsVisitorTicketTypePage(
    props: PageProps<'/admin/events/[event]/tickets/visitors/[type]'>)
{
    const { event } = await requireAuthenticationWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const { type } = await props.params;

    const service = await createTicketService(event.slug);
    const tickets = await service?.listTicketTypes();

    const ticket = tickets?.find(ticket => ticket.id.toString() === type);
    if (!ticket)
        notFound();

    const columns: Column<ExtractRowModel<typeof eventVisitorTicketsDataSource>>[] = [
        {
            field: 'cancelled',
            headerAlign: 'center',
            align: 'center',
            sortable: true,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: ValidityHeaderCell,
                component: ValidityCell,
            },
        },
        {
            field: 'order',
            headerName: 'Order',
            sortable: true,
            width: 150,

            template: 'text',
            templateProps: {
                href: `/admin/events/${event.slug}/tickets/visitors/` +
                    `${ticket.id}/{purchaseId}`,
            },
        },
        {
            field: 'holder',
            headerName: 'Ticket holder',
            sortable: true,
            flex: 1,

            template: 'component',
            templateProps: {
                component: HolderCell,
            },
        },
        {
            field: 'purchased',
            headerName: 'Purchased',
            sortable: true,
            width: 150,

            template: 'date',
        },
    ];

    return (
        <>
            <Section icon={ <ConfirmationNumberOutlinedIcon color="primary" /> }
                     title={ticket.name} documentation="event/tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Visitors', href: `/admin/events/${event.slug}/tickets/visitors` },
                        {
                            label: ticket.name,
                        }
                     ]}>
                <SectionIntroduction>
                    Overview of all tickets of this type purchased for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventVisitorTicketsDataSource}
                           context={{ event: event.slug, type }}
                           defaultSort={{ field: 'purchased', sort: 'desc' }}
                           subject="ticket"
                           listViewProps={{
                               primaryField: 'holder',
                               secondaryTemplate: '{purchaseIdFormatted} • Ticket #{id}',
                               startComponent: ValidityCell,
                               linkTemplate: `/admin/events/${event.slug}/tickets/visitors/` +
                                   `${ticket.id}/{purchaseId}`,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'type', prefix: 'Ticket #' }, 'Visitors', 'Tickets',
                             { event: 'event' });

