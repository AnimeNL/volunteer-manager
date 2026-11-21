// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { IssuedCell, IssuedHeaderCell } from '../TicketCells';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { executeAccessCheck } from '@lib/auth/access';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tRoles, tUsers, tUsersEvents, tUsersEventsTickets } from '@lib/database';

/**
 * Data source for volunteer tickets granted for an event.
 */
const eventTicketDataSource = createDataSource('admin/event/tickets/volunteers', withContext({
    /**
     * Event for which the tickets are being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the volunteer's account.
     */
    id: z.number(),

    /**
     * The volunteer's display name, or full name.
     */
    name: z.string(),

    /**
     * Role that the volunteer fulfils.
     */
    role: z.string(),

    /**
     * Order number of the ticket that has been assigned to them, if any.
     */
    order: z.string().optional(),

    /**
     * Date at which the ticket was created, if any.
     */
    created: z.iso.datetime().optional(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'volunteers.tickets',
            operation: 'read',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        const service = await createTicketService(context.event.slug);
        if (!service)
            return { rowCount: 0, rows: [] };  // no service is available

        if (!context.event.tickets?.volunteerTicketId)
            return { rowCount: 0, rows: [] };  // no ticket has been specified

        const usersEventsTicketsJoin = tUsersEventsTickets.forUseInLeftJoin();

        const dbInstance = db;

        const volunteers = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .leftJoin(usersEventsTicketsJoin)
                .on(usersEventsTicketsJoin.userId.equals(tUsersEvents.userId))
                    .and(usersEventsTicketsJoin.eventId.equals(tUsersEvents.eventId))
            .where(tUsersEvents.eventId.equals(context.event.id))
                .and(tUsersEvents.registrationStatus.equals('Accepted'))
                .and(tUsers.name.containsInsensitiveIfValue(params.search)
                    .or(tRoles.roleName.containsInsensitiveIfValue(params.search))
                    .or(usersEventsTicketsJoin.ticketProviderPurchaseId.containsInsensitiveIfValue(
                        params.search)))
            .select({
                id: tUsersEvents.userId,
                name: tUsers.name,
                roles: dbInstance.aggregateAsArray({
                    name: tRoles.roleName,
                    primary: usersEventsTicketsJoin.teamIdPrimary.equals(tUsersEvents.teamId),
                }),
            })
            .groupBy(tUsersEvents.userId)
            .orderBy('name', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        const volunteerTickets = await service.listVolunteerTickets(
            context.event.id, volunteers.data.map(volunteer => volunteer.id));

        return {
            rowCount: volunteers.count,
            rows: volunteers.data.map(volunteer => {
                const ticketInfo = volunteerTickets.get(volunteer.id);
                const activeTicket =
                    ticketInfo && !ticketInfo.cancelled ? ticketInfo : undefined;

                const role =
                    volunteer.roles.find(entry => entry.primary)?.name ??
                    volunteer.roles[0]?.name ??
                    '';

                return {
                    id: volunteer.id,
                    name: volunteer.name,
                    role,
                    order: activeTicket
                        ? service.formatPurchaseId(activeTicket.purchaseId)
                        : undefined,
                    created: activeTicket?.paid,
                };
            }),
        };
    },
});

/**
 * Page that provides an overview of all volunteers confirmed to help out during a particular event,
 * and whether a ticket has been granted to them already.
 */
export default async function EventTicketsVolunteersPage(
    props: PageProps<'/admin/events/[event]/tickets/volunteers'>)
{
    const { event } = await requireAuthenticationWithEvent(props, {
        permission: 'volunteers.tickets',
        operation: 'read',
    });

    const columns: Column<ExtractRowModel<typeof eventTicketDataSource>>[] = [
        {
            field: 'id',
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: IssuedHeaderCell,
                component: IssuedCell,
            },
        },
        {
            field: 'order',
            headerName: 'Order',
            sortable: false,
            width: 150,

            template: 'text',
            templateProps: {
                defaultValue: 'No ticket',
                href: './volunteers/{id}',
            },
        },
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: true,
            flex: 1,

            // TODO: Chips for the team(s) they participate in?

            template: 'text',
        },
        {
            field: 'role',
            headerName: 'Role',
            sortable: false,
            flex: 1,

            template: 'text',
        },
        {
            field: 'created',
            headerName: 'Created',
            sortable: true,
            width: 150,

            template: 'date',
        },
    ];

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> }
                     title="Volunteer tickets" documentation="event/tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Volunteers' },
                     ]}>
                <SectionIntroduction>
                    Overview of the tickets granted to our {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventTicketDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           search="prominent" subject="ticket"
                           listViewProps={{
                               primaryField: 'name',
                               secondaryField: 'order',
                               startComponent: IssuedCell,
                               linkTemplate: './volunteers/{id}',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Volunteers', 'Tickets', { event: 'event' });
