// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden, notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Typography from '@mui/material/Typography';

import { ActionBar } from '@app/admin/components/ActionBar';
import { AssociateQuickAction } from './AssociateQuickAction';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { YourTicketProviderPurchaseItem } from './YourTicketProviderPurchaseItem';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationContextWithEvent } from '../../../requireAuthenticationContextWithEvent';
import db, { tUsers, tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { associatePurchase } from '../../TicketActions';

/**
 * Page that provides insight in the ticket granted to an individual external to our team.
 */
export default async function EventTicketsExternalPage(
    props: PageProps<'/admin/events/[event]/tickets/externals/[id]'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const dbInstance = db;
    const params = await props.params;

    const service = await createTicketService(event.slug);

    const purchase = await service?.fetchPurchase(params.id);
    if (!purchase || !service)
        notFound();

    const containsVolunteerTicket = purchase.tickets.some(
        ticket => `${ticket.ticketId}` === event.tickets?.volunteerTicketId);

    if (!containsVolunteerTicket && !access.can('root'))
        forbidden();

    const purchaseLink = service.createPurchaseLink(params.id) || '#';

    // ---------------------------------------------------------------------------------------------
    // Functionality: Associating the ticket with a volunteer
    // ---------------------------------------------------------------------------------------------

    const associatePurchaseFn = associatePurchase.bind(null, event.slug, purchase.id);

    const usersEventsTicketsJoin = tUsersEventsTickets.forUseInLeftJoin();

    const associateVolunteers = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(usersEventsTicketsJoin)
            .on(usersEventsTicketsJoin.userId.equals(tUsersEvents.userId))
                .and(usersEventsTicketsJoin.eventId.equals(tUsersEvents.eventId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.registrationStatus.equals('Accepted'))
        .select({
            id: tUsers.userId,
            label: tUsers.name,
            disabled: usersEventsTicketsJoin.ticketProviderPurchaseId.isNotNull(),
        })
        .groupBy(tUsersEvents.userId)
        .orderBy('label', 'asc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    const canUpdateTickets = access.can('event.tickets', 'update', { event: event.slug });

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Purchase"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Externals',
                            href: `/admin/events/${event.slug}/tickets/externals`,
                        },
                        { label: `REF${params.id}` },
                     ]}>
                <SectionIntroduction>
                    Information about the ticket{purchase.tickets.length === 1 ? '' : 's'} issued
                    as part of purchase REF{params.id} for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back tabs>
                { !containsVolunteerTicket &&
                    <Alert severity="warning" variant="outlined">
                        This purchase does not contain any volunteer tickets.
                    </Alert> }
                { canUpdateTickets &&
                    <ActionBar>
                        <AssociateQuickAction action={associatePurchaseFn}
                                              ticketProvider={service.id}
                                              volunteers={associateVolunteers} />
                    </ActionBar> }
                <KeyValueList items={[
                    {
                        key: 'Purchase ID',
                        valueTemplate: 'component',
                        value: (
                            <Typography variant="body2">
                                {purchase.id}
                                <MuiLink component={Link} href={purchaseLink} target="_blank">
                                    <OpenInNewIcon fontSize="inherit" sx={{
                                        position: 'relative',
                                        left: '6px',
                                        top: '2px',
                                    }} />
                                </MuiLink>
                            </Typography>
                        ),
                    },
                    {
                        key: 'Event ID',
                        value: purchase.eventId,
                    },
                    {
                        condition: !!purchase.paid,
                        key: 'Paid',
                        valueTemplate: 'localDateTime',
                        value: purchase.paid?.toString(),
                    },
                    {
                        condition: !!purchase.cancelled,
                        key: 'Cancelled',
                        valueTemplate: 'localDateTime',
                        value: purchase.cancelled?.toString(),
                    }
                ]} />
            </Section>
            { service.id === 'YourTicketProvider' && purchase.tickets.map(ticket =>
                <YourTicketProviderPurchaseItem key={ticket.id} event={event.slug} service={service}
                                                ticket={ticket} readOnly={!canUpdateTickets} /> ) }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'REF' }, 'Externals', 'Tickets',
                             { event: 'event' });
