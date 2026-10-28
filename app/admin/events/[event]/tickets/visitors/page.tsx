// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Grid from '@mui/material/Grid';
import PublicIcon from '@mui/icons-material/Public';

import type { TicketService } from '@lib/tickets/TicketService';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { LiveCell, LiveHeaderCell } from '../TicketCells';
import { MetricGridItem } from './MetricGridItem';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { TicketSearchBar } from './TicketSearchBar';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Formatter to display a price in euros.
 */
const kPriceFormatter = new Intl.NumberFormat('en-UK', {
    style: 'currency',
    currency: 'EUR',
});

/**
 * Data source for visitor ticket types obtained from the ticketing provider.
 */
const eventTicketTypesDataSource = createDataSource('admin/event/tickets/visitors', withContext({
    /**
     * Event for which the tickets are being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the ticket type.
     */
    id: z.string().or(z.number()),

    /**
     * Whether the ticket type is currently live.
     */
    live: z.boolean(),

    /**
     * Human-readable name of the ticket type.
     */
    name: z.string(),

    /**
     * Price of the ticket type, formatted as string.
     */
    price: z.string(),

    /**
     * Number of sold (non-cancelled, issued) tickets of this type, when known.
     */
    sold: z.number().optional(),

    /**
     * Number of tickets of this type that can be issued.
     */
    amount: z.number().optional(),

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
        const service = await createTicketService(context.event.slug, props.user?.id);
        if (!service)
            return { rowCount: 0, rows: [] };

        const ticketTypes = await service.listTicketTypes();

        const searchQuery = params.search?.toLocaleLowerCase();
        const filtered = ticketTypes.filter(ticketType => {
            if (!searchQuery)
                return true;

            return ticketType.name.toLocaleLowerCase().includes(searchQuery);
        });

        const sorted = filtered.sort((lhs, rhs) => {
            let comparison = 0;
            const field = params.sort.field;

            if (field === 'name') {
                comparison = lhs.name.localeCompare(rhs.name);
            } else if (field === 'price') {
                comparison = lhs.price - rhs.price;
            } else if (field === 'live') {
                comparison = (lhs.active ? 1 : 0) - (rhs.active ? 1 : 0);
            } else if (field === 'sold') {
                comparison = (lhs.sold || 0) - (rhs.sold || 0);
            } else {
                comparison = String(lhs.id).localeCompare(String(rhs.id));
            }

            return params.sort.direction === 'asc' ? comparison : -comparison;
        });

        const paginated = sorted.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: sorted.length,
            rows: paginated.map(ticketType => ({
                id: ticketType.id,
                name: ticketType.name,
                price: kPriceFormatter.format(ticketType.price / 100),
                live: ticketType.active,
                sold: ticketType.sold,
                amount: ticketType.amount,
            })),
        };
    },
});

/**
 * Page that displays the ticket types that visitors have purchased for a particular event.
 */
export default async function EventTicketsVisitorsPage(
    props: PageProps<'/admin/events/[event]/tickets/visitors'>)
{
    const { event, user } = await requireAuthenticationWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const service = await createTicketService(event.slug, user.id);
    if (!service)
        notFound();

    const columns: Column<ExtractRowModel<typeof eventTicketTypesDataSource>>[] = [
        {
            field: 'live',
            headerAlign: 'center',
            align: 'center',
            sortable: true,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: LiveHeaderCell,
                component: LiveCell,
            },
        },
        {
            field: 'name',
            headerName: 'Ticket type',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                href: './visitors/{id}',
            },
        },
        {
            field: 'price',
            headerAlign: 'right',
            headerName: 'Price',
            align: 'right',
            sortable: true,
            width: 125,
        },
        {
            field: 'sold',
            headerAlign: 'right',
            headerName: 'Sold',
            align: 'right',
            sortable: true,
            width: 125,

            template: 'number',
            templateProps: {
                limit: 'amount',
            },
        }
    ];

    return (
        <>
            <Section icon={ <PublicIcon color="primary" /> }
                     title="Visitor tickets" documentation="event/tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Visitors' },
                     ]}>
                <SectionIntroduction>
                    Overview of all tickets that were purchased for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <TicketSearchBar eventSlug={event.slug} />
                <DataTable columns={columns} source={eventTicketTypesDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           subject="ticket type"
                           listViewProps={{
                               primaryField: 'name',
                               secondaryTemplate: 'Price: {price} (sold {sold})',
                               startComponent: LiveCell,
                               linkTemplate: './visitors/{id}',
                           }} />
            </Section>
            <Suspense fallback={ <SectionLoading /> }>
                <TicketSaleStatistics service={service} />
            </Suspense>
        </>
    );
}

/**
 * Fetching ticket statistics could take a little bit of time, so move it to a suspended block to
 * avoid the metrics affecting page load performance.
 */
async function TicketSaleStatistics(props: { service: TicketService }) {
    const stats = await props.service.getStatistics();
    if (!stats)
        return null;

    return (
        <Grid container spacing={1.5}>
            <MetricGridItem title="Tickets"
                            data={[
                                { label: 'Purchases', value: stats.tickets.purchases },
                                { label: 'Guest list', value: stats.tickets.guestList },
                            ]} />
            <MetricGridItem title="Subproducts"
                            data={[
                                { label: 'Purchases', value: stats.subproducts.purchases },
                                { label: 'Guest list', value: stats.subproducts.guestList },
                            ]} />
            <MetricGridItem title="Last week"
                            data={[
                                { label: 'Purchases', value: stats.lastWeek.purchases },
                                { label: 'Guest list', value: stats.lastWeek.guestList },
                            ]} />
            <MetricGridItem title="Total"
                            data={[
                                { label: 'Purchases', value: stats.total.purchases },
                                { label: 'Guest list', value: stats.total.guestList },
                            ]} />
        </Grid>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Visitors', 'Tickets', { event: 'event' });
