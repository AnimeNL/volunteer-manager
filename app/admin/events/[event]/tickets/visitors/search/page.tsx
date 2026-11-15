// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import PublicIcon from '@mui/icons-material/Public';

import type { TicketSearchSortField } from '@lib/tickets/Types';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { HolderCell, ValidityCell, ValidityHeaderCell } from '../../TicketCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TicketSearchBar } from '../TicketSearchBar';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Data source for visitor ticket types obtained from the ticketing provider.
 */
const eventTicketSearchDataSource = createDataSource('event/tickets/search', withContext({
    /**
     * Event for which the tickets are being obtained.
     */
    event: kEventTransformer,

    /**
     * Search query that should be shown in the results.
     */
    query: z.string(),

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
     * Relative URL fragment linking to this ticket purchase ({type}/{purchaseId}).
     */
    link: z.string(),

    /**
     * Formatted unique ID of the purchase that this ticket is part of.
     */
    order: z.string(),

    /**
     * Name of the holder of the ticket, when known.
     */
    holder: z.string().optional(),

    /**
     * Name of the ticket that they have purchased.
     */
    ticket: z.string().optional(),

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

        const { count, results } = await service.searchTickets({
            query: context.query,
            limit: params.page.limit,
            offset: params.page.offset,
            sort: {
                field: params.sort.field as TicketSearchSortField,
                direction: params.sort.direction,
            },
        });

        return {
            rowCount: count,
            rows: results.map(row => ({
                id: row.id,
                purchaseId: row.purchaseId,
                link: `${row.ticketId}/${row.purchaseId}`,
                order: service.formatPurchaseId(row.purchaseId),
                holder: row.holder,
                ticket: row.ticketName,
                purchased: row.purchased,
                cancelled: row.cancelled,
                complimentary: row.complimentary,
            })),
        };
    },
});

/**
 * Page that displays the ticket types that visitors have purchased for a particular event.
 */
export default async function EventTicketsVisitorSearchPage(
    props: PageProps<'/admin/events/[event]/tickets/visitors/search'>)
{
    const { event } = await requireAuthenticationWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const service = await createTicketService(event.slug);
    if (!service)
        notFound();

    const searchParams = await props.searchParams;
    const query = typeof searchParams.for === 'string' ? searchParams.for : undefined;

    // ---------------------------------------------------------------------------------------------

    const columns: Column<ExtractRowModel<typeof eventTicketSearchDataSource>>[] = [
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
                href: `/admin/events/${event.slug}/tickets/visitors/{link}`,
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
            field: 'ticket',
            headerName: 'Ticket',
            sortable: true,
            flex: 1,
        },
    ];

    return (
        <>
            <Section icon={ <PublicIcon color="primary" /> }
                     title="Visitor tickets" documentation="event/tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Visitors', href: `/admin/events/${event.slug}/tickets/visitors` },
                        {
                            label: 'Search',
                        }
                     ]}>
                <SectionIntroduction>
                    Overview of all tickets that were purchased for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <TicketSearchBar eventSlug={event.slug} query={query} />
                { !query &&
                    <Alert severity="warning" variant="outlined">
                        We can't read minds yet! Please enter your query above to get started.
                    </Alert> }
                { !!query &&
                    <DataTable columns={columns} source={eventTicketSearchDataSource}
                               context={{ event: event.slug, query }}
                               defaultSort={{ field: 'purchased', sort: 'desc' }}
                               subject="ticket" disableSearch
                               listViewProps={{
                                   primaryField: 'holder',
                                   secondaryTemplate: '{order} • Ticket #{id}',
                                   startComponent: ValidityCell,
                                   linkTemplate: `/admin/events/${event.slug}/tickets/visitors/` +
                                       `{link}`,
                               }} /> }
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Search', 'Visitors', 'Tickets', { event: 'event' });
