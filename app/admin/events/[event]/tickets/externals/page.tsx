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

        const tickets = await service.listTicketsForType(context.event.tickets.volunteerTicketId);

        // TODO: Filter away those associated with known volunteers

        return {
            rowCount: tickets.length,
            rows: tickets,
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
                           defaultSort={{ field: 'id', sort: 'asc' }}
                           subject="ticket"
                           listViewProps={{
                               primaryField: 'id',
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
                            <TextFieldElement name="displayName" label="Display name" fullWidth
                                              size="small" />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextFieldElement name="email" label="E-mail address" required fullWidth
                                              type="email" size="small" />
                        </Grid>
                        { /* TODO: Team? */ }
                        { /* TODO: Function? */ }
                    </FormGrid>
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Externals', 'Tickets', { event: 'event' });
