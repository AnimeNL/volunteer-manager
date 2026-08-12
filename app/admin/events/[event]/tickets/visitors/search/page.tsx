// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import PublicIcon from '@mui/icons-material/Public';

import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { HolderCell, ValidityCell, ValidityHeaderCell } from '../../TicketCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TicketSearchBar } from '../TicketSearchBar';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationContextWithEvent } from '../../../requireAuthenticationContextWithEvent';
import db, { tYourTicketProviderPurchases, tYourTicketProviderTickets } from '@lib/database';

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
            check: 'admin-event',
            event: context.event.slug,
            permission: {
                permission: 'event.tickets',
                operation: 'read',
                scope: {
                    event: context.event.slug,
                },
            },
        });
    },

    async list(params, props, context) {
        const service = await createTicketService(context.event.slug);
        if (!service || service.id !== 'YourTicketProvider')
            return { rowCount: 0, rows: [] };

        const { query } = context;

        // TODO: Implement ticket search for Weeztix and/or other ticketing partners.

        const dbInstance = db;

        const purchaseIdCast = dbInstance.fragmentWithType('string', 'required')
            .sql`CAST(${tYourTicketProviderPurchases.ytpPurchaseId} AS CHAR)`;
        const ticketIdCast = dbInstance.fragmentWithType('string', 'required')
            .sql`CAST(${tYourTicketProviderPurchases.ytpPurchaseItemId} AS CHAR)`;

        const purchases = await dbInstance.selectFrom(tYourTicketProviderPurchases)
            .innerJoin(tYourTicketProviderTickets)
                .on(tYourTicketProviderTickets.ytpTicketId.equals(
                    tYourTicketProviderPurchases.ytpPurchaseItemTicketId))
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(Number(service.eventId)))
                .and(
                    tYourTicketProviderPurchases.ytpPurchaseItemHolder.containsInsensitive(query).or(
                    tYourTicketProviderTickets.ytpTicketName.containsInsensitive(query).or(
                    purchaseIdCast.containsInsensitive(query).or(
                    ticketIdCast.containsInsensitive(query)))))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseItemId,
                purchaseId: tYourTicketProviderPurchases.ytpPurchaseId,
                holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                ticket: tYourTicketProviderTickets.ytpTicketName,
                purchased: dbInstance.dateTimeAsString(
                    tYourTicketProviderPurchases.ytpPurchaseDatePaid),
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled.isNotNull(),
                complimentary: tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(1),
            })
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: purchases.count,
            rows: purchases.data.map(row => ({
                ...row,
                order: service.formatPurchaseId(row.purchaseId),
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
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const service = await createTicketService(event.slug);
    if (!service)
        notFound();

    const { q } = await props.searchParams;
    const query = typeof q === 'string' ? q : undefined;

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
                     title="Visitor tickets"
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
                                   secondaryTemplate: '{purchaseIdFormatted} • Ticket #{id}',
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
