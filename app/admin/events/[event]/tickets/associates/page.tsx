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
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';
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
     * Date at which the ticket was created, if any.
     */
    created: z.iso.datetime().optional(),

    /**
     * Whether the ticket has been cancelled,
     */
    cancelled: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event.slug,
            permission: {
                permission: 'volunteers.tickets',
                operation: 'read',
                scope: {
                    event: context.event.slug,
                },
            },
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
                return true;  // the |ticket| does not match the search query

            return ticket.barcode?.toLocaleLowerCase().includes(searchQuery) ||
                   ticket.holder?.toLocaleLowerCase().includes(searchQuery) ||
                   `ref${ticket.purchaseId}`.includes(searchQuery);
        });

        const sortedTickets = filteredTickets.sort((lhs, rhs) => {
            if (lhs.cancelled !== rhs.cancelled)
                return lhs.cancelled ? 1 : -1;  // sort cancelled tickets last

            if (lhs.holder && rhs.holder)
                return lhs.holder.localeCompare(rhs.holder);  // sort by name when known

            return 0;
        });

        const selectedTickets = sortedTickets.slice(
            params.page.offset, params.page.offset + params.page.limit);

        return {
            rowCount: sortedTickets.length,
            rows: selectedTickets.map(ticket => ({
                id: ticket.id,
                purchaseId: ticket.purchaseId,
                holder: ticket.holder ?? '(Unclaimed ticket)',
                order: service.id === 'YourTicketProvider' ? `REF${ticket.purchaseId}`
                                                           : ticket.purchaseId.toString(),
                created: ticket.paid?.toString(),
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
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'volunteers.tickets',
        operation: 'read',
    });

    const service = await createTicketService(event.slug);
    const serviceCanCreateTickets =
        service && access.can('volunteers.tickets', 'create', { event: event.slug });

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
            sortable: false,
            width: 150,
        },
        {
            field: 'holder',
            headerName: 'Ticket holder',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                defaultValue: 'Identity unknown…',
                href: './associates/{purchaseId}',
            },
        },
        {
            field: 'created',
            headerName: 'Created',
            sortable: true,
            width: 150,

            template: 'date',
        },
    ];

    const createAction = createAssociateTicket.bind(null, event.slug);

    return (
        <>
            <Section icon={ <Diversity1Icon color="primary" /> }
                     title="Associate tickets" documentation="event/tickets"
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
                           subject="ticket"
                           listViewProps={{
                               primaryField: 'holder',
                               secondaryTemplate: 'REF{purchaseId}',
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
