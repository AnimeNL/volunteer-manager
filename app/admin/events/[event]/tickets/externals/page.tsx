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

import { createExternalTicket } from '../TicketActions';

/**
 * Data source for external tickets granted for an event.
 */
const eventExternalTicketDataSource = createDataSource('admin/event/tickets/external', withContext({
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
     * Name of the person who holds the ticket, when known.
     */
    holder: z.string().nullish(),

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
        if (!service)
            return { rowCount: 0, rows: [] };  // no service is available

        if (!context.event.tickets?.volunteerTicketId)
            return { rowCount: 0, rows: [] };  // no ticket has been specified

        const searchQuery = params.search?.toLocaleLowerCase();

        const tickets = await service.listTicketsForType(context.event.tickets.volunteerTicketId);
        const filteredTickets = tickets.filter(ticket => {
            if (!searchQuery)
                return true;

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
                id: ticket.purchaseId,
                holder: ticket.holder,
                order: `REF${ticket.purchaseId}`,
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
export default async function EventTicketsExternalsPage(
    props: PageProps<'/admin/events/[event]/tickets/externals'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const service = await createTicketService(event.slug);
    const serviceCanCreateTickets =
        service && access.can('event.tickets', 'create', { event: event.slug });

    // ---------------------------------------------------------------------------------------------

    const columns: Column<ExtractRowModel<typeof eventExternalTicketDataSource>>[] = [
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

            template: 'text',
            templateProps: {
                href: './externals/{id}',
            },
        },
        {
            field: 'holder',
            headerName: 'Ticket holder',
            sortable: true,
            flex: 1,

            template: 'text',
            templateProps: {
                defaultValue: 'Identity anonimised',
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

    const createAction = createExternalTicket.bind(null, event.slug);

    return (
        <>
            <Section icon={ <Diversity1Icon color="primary" /> }
                     title="External tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Externals' },
                     ]}>
                <SectionIntroduction>
                    Overview of the tickets granted to people external to the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventExternalTicketDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'holder', sort: 'asc' }}
                           subject="ticket"
                           listViewProps={{
                               primaryField: 'holder',
                               secondaryTemplate: 'REF{id}',
                               startComponent: ValidityCell,
                               linkTemplate: './externals/{id}',
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
    createGenerateMetadataFn('Externals', 'Tickets', { event: 'event' });
