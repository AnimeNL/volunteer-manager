// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import Diversity1Icon from '@mui/icons-material/Diversity1';
import Grid from '@mui/material/Grid';

import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ValidityCell, ValidityHeaderCell } from '../TicketCells';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { createAssociateTicket } from '../TicketActions';

/**
 * Data source for associate tickets granted for an event.
 */
const eventAssociateTicketDataSource = createDataSource('event/tickets/associates', withContext({
    /**
     * Event for which the tickets are being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the date as it exists in the database.
     */
    id: z.number().or(z.string()),

    /**
     * Unique ID of the purchase as it exists in the database.
     */
    purchaseId: z.number().or(z.string()),

    /**
     * Name of the person who holds the ticket, when known.
     * @default "(Unclaimed ticket)"
     */
    holder: z.string().optional(),

    /**
     * Name of the order that this ticket is part of.
     */
    order: z.string(),

    /**
     * Function of the person who holds the ticket, when known.
     */
    function: z.string().optional(),

    /**
     * Organisation of the person who holds the ticket, when known.
     */
    organisation: z.string().optional(),

    /**
     * Whether the ticket has been cancelled,
     */
    cancelled: z.boolean(),

}), {
    async authorize(operation, props, context) {
        await requireAuthenticationWithEvent(props.authenticationContext, context.event.slug, {
            permission: 'volunteers.tickets',
            operation: 'read',
        });
    },

    async list(params, props, context) {
        const service = await createTicketService(context.event.slug);
        if (!service)
            return { rowCount: 0, rows: [] };  // no service is available

        if (!context.event.tickets?.volunteerTicketId)
            return { rowCount: 0, rows: [] };  // no ticket has been specified

        const validAssociatedTickets = await db.selectFrom(tUsersEventsTickets)
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tUsersEventsTickets.userId))
                    .and(tUsersEvents.eventId.equals(tUsersEventsTickets.eventId))
                    .and(tUsersEvents.registrationStatus.equals('Accepted'))
            .where(tUsersEventsTickets.eventId.equals(context.event.id))
            .selectOneColumn(tUsersEventsTickets.ticketProviderPurchaseId)
            .executeSelectMany();

        const validAssociatedTicketsSet = new Set(validAssociatedTickets);

        const searchQuery = params.search?.toLocaleLowerCase();

        const tickets = await service.listTicketsForType(context.event.tickets.volunteerTicketId);
        const filteredTickets = tickets.filter(ticket => {
            if (validAssociatedTicketsSet.has(`${ticket.purchaseId}`))
                return false;  // the |ticket| is associated with a current volunteer

            if (!searchQuery)
                return true;

            const status = ticket.cancelled ? 'cancelled' : 'issued';

            return status === searchQuery ||
                   ticket.barcode?.toLocaleLowerCase().includes(searchQuery) ||
                   ticket.holder?.toLocaleLowerCase().includes(searchQuery) ||
                   ticket.function?.toLocaleLowerCase().includes(searchQuery) ||
                   ticket.organisation?.toLocaleLowerCase().includes(searchQuery) ||
                   service.formatPurchaseId(ticket.purchaseId)
                       .toLocaleLowerCase().includes(searchQuery);
        });

        const sortedTickets = filteredTickets.sort((lhs, rhs) => {
            if (lhs.cancelled !== rhs.cancelled)
                return lhs.cancelled ? 1 : -1;  // sort cancelled tickets last

            let comparison = 0;
            switch (params.sort.field) {
                case 'order':
                    comparison = service.formatPurchaseId(lhs.purchaseId).localeCompare(
                        service.formatPurchaseId(rhs.purchaseId));
                    break;

                case 'holder':
                    comparison = (lhs.holder ?? '').localeCompare(rhs.holder ?? '');
                    break;

                case 'function':
                    comparison = (lhs.function ?? '').localeCompare(rhs.function ?? '');
                    break;

                case 'organisation':
                    comparison = (lhs.organisation ?? '').localeCompare(rhs.organisation ?? '');
                    break;
            }

            return params.sort.direction === 'asc' ? comparison : -comparison;
        });

        const selectedTickets = sortedTickets.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: sortedTickets.length,
            rows: selectedTickets.map(ticket => ({
                id: ticket.id,
                purchaseId: ticket.purchaseId,
                holder: ticket.holder ?? '(Unclaimed ticket)',
                function: ticket.function,
                organisation: ticket.organisation,
                order: service.formatPurchaseId(ticket.purchaseId),
                cancelled: !!ticket.cancelled,
            })),
        };
    },
});

/**
 * Page that provides an overview of volunteering tickets granted to people external to our system.
 * They could have been manually added, or these could be orphaned tickets caused by a bug.
 */
export default async function EventTicketsAssociatesPage(
    props: PageProps<'/admin/events/[event]/tickets/associates'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, {
        permission: 'volunteers.tickets',
        operation: 'read',
    });

    const allowedToCreateTickets =
        access.can('volunteers.tickets', 'create', { event: event.slug });

    const service = await createTicketService(event.slug);
    const serviceCanCreateTickets =
        allowedToCreateTickets && !!service?.capabilities.canCreateOrder;

    // ---------------------------------------------------------------------------------------------

    const columns: Column<ExtractRowModel<typeof eventAssociateTicketDataSource>>[] = [
        {
            field: 'id',
            headerAlign: 'center',
            align: 'center',
            sortable: false,
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
                href: './associates/{purchaseId}',
            },
        },
        {
            field: 'holder',
            headerName: 'Ticket holder',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                defaultValue: 'Identity unknown…',
            },
        },
        {
            field: 'function',
            headerName: 'Function',
            sortable: true,
            flex: 1,

            template: 'text',
        },
        {
            field: 'organisation',
            headerName: 'Organisation',
            sortable: true,
            flex: 1,

            template: 'text',
        },
    ];

    const createAction = createAssociateTicket.bind(null, event.slug);

    return (
        <>
            <Section icon={ <Diversity1Icon color="primary" /> }
                     title="Associate tickets" documentation="event/tickets"
                     limited={!allowedToCreateTickets}
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Associates' },
                     ]}>
                <SectionIntroduction>
                    Volunteering tickets granted to people external to the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventAssociateTicketDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'holder', sort: 'asc' }}
                           search="prominent" subject="ticket"
                           listViewProps={{
                               primaryField: 'holder',
                               secondaryTemplate: '{order}',
                               startComponent: ValidityCell,
                               linkTemplate: './associates/{purchaseId}',
                           }} />
            </Section>
            { serviceCanCreateTickets &&
                <Section icon={ <AddBoxOutlinedIcon /> } title="Create a ticket">
                    <SectionIntroduction>
                        Directly issue a free ticket to a volunteer not known to the Volunteer
                        Manager. They will receive an e-mail from {event.tickets?.provider}.
                    </SectionIntroduction>
                    <FormGrid action={createAction} callToAction="Issue ticket">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="firstName" label="First name" required
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="lastName" label="Last name" required
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextFieldElement name="email" label="E-mail address" required fullWidth
                                              type="email" size="small" />
                        </Grid>
                        { /* TODO: Display name? */ }
                        { /* TODO: Team? */ }
                        { /* TODO: Function? */ }
                    </FormGrid>
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Associates', 'Tickets', { event: 'event' });
