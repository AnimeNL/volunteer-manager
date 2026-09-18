// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { ActionBar } from '@app/admin/components/ActionBar';
import { CancelPurchaseQuickAction } from '../../associates/[id]/CancelPurchaseQuickAction';
import { DisassociateQuickAction } from './DisassociateQuickAction';
import { ResendConfirmationQuickAction } from '../../associates/[id]/ResendConfirmationQuickAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsTickets, tYourTicketProviderPurchases } from '@lib/database';

import { cancelPurchase, disassociatePurchase, resendPurchaseConfirmation }
    from '../../TicketActions';

/**
 * Page that provides insight in the ticket granted for an individual volunteer. It provides options
 * to (re)issue the ticket, or to revoke it with a given reason.
 */
export default async function EventTicketsVolunteerPage(
    props: PageProps<'/admin/events/[event]/tickets/volunteers/[id]'>)
{
    const params = await props.params;
    const { access, event } = await requireAuthenticationWithEvent(props, {
        permission: 'volunteers.tickets',
        operation: 'read',
    });

    const usersEventsTicketsJoin = tUsersEventsTickets.forUseInLeftJoin();
    const yourTicketProviderPurchasesJoin = tYourTicketProviderPurchases.forUseInLeftJoin();

    const dbInstance = db;

    const purchaseIdCast = dbInstance.fragmentWithType('int', 'optional')
        .sql`CAST(${usersEventsTicketsJoin.ticketProviderPurchaseId} AS INTEGER)`;

    const participation = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(usersEventsTicketsJoin)
            .on(usersEventsTicketsJoin.userId.equals(tUsersEvents.userId))
                .and(usersEventsTicketsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(yourTicketProviderPurchasesJoin)
            .on(usersEventsTicketsJoin.ticketProvider.equals('YourTicketProvider'))
                .and(yourTicketProviderPurchasesJoin.ytpPurchaseId.equals(purchaseIdCast))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.userId.equals(parseInt(params.id, /* radix= */ 10)))
        .select({
            events: dbInstance.aggregateAsArray({

            }),
            user: {
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            },
            yourTicketProvider: {
                id: yourTicketProviderPurchasesJoin.ytpPurchaseItemId,
                purchaseId: yourTicketProviderPurchasesJoin.ytpPurchaseId,
                purchaseCancelled: yourTicketProviderPurchasesJoin.ytpPurchaseDateCancelled,
                purchasePaid: yourTicketProviderPurchasesJoin.ytpPurchaseDatePaid,
            },
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!participation)
        notFound();

    const purchaseId = participation.yourTicketProvider?.purchaseId;

    // ---------------------------------------------------------------------------------------------

    const hasAssociatedTicket = !!participation.yourTicketProvider?.purchaseId;

    const canDeleteTickets = access.can('volunteers.tickets', 'delete', { event: event.slug });
    const canUpdateTickets = access.can('volunteers.tickets', 'update', { event: event.slug });

    const cancelPurchaseFn =
        canDeleteTickets && !!purchaseId
            ? cancelPurchase.bind(null, event.slug, purchaseId)
            : undefined!;

    const disassociateFn =
        canUpdateTickets ? disassociatePurchase.bind(null, event.slug, participation.user.id)
                         : undefined!;

    const resendConfirmationFn =
        canUpdateTickets && !!purchaseId
            ? resendPurchaseConfirmation.bind(null, event.slug, purchaseId)
            : undefined!;

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Tickets"
                     documentation="event/tickets" limited={!canUpdateTickets || !canDeleteTickets}
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Volunteers',
                            href: `/admin/events/${event.slug}/tickets/volunteers`,
                        },
                        { label: participation.user.name },
                     ]}>
                <SectionIntroduction>
                    Information about any tickets issued to {participation.user.name} for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back tabs>
                { !participation.yourTicketProvider &&
                    <Alert severity="warning" variant="outlined">
                        {participation.user.firstName} has not been issued a ticket for{' '}
                        {event.shortName}{ canUpdateTickets ? '—you can issue one below' : '' }.
                    </Alert> }
                { !!participation.yourTicketProvider?.purchaseCancelled &&
                    <Alert severity="error" variant="outlined">
                        {participation.user.firstName} has been issued a ticket that has
                        inadvertently been cancelled.
                        { canUpdateTickets && ' You need to disassociate their ticket below.' }
                    </Alert> }
                { ((canDeleteTickets || canUpdateTickets) && hasAssociatedTicket) &&
                    <ActionBar>
                        { canUpdateTickets &&
                            <DisassociateQuickAction action={disassociateFn} /> }
                        { canUpdateTickets &&
                            <ResendConfirmationQuickAction action={resendConfirmationFn} /> }
                        { canDeleteTickets &&
                            <CancelPurchaseQuickAction action={cancelPurchaseFn} /> }
                    </ActionBar> }
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Volunteers', 'Tickets', { event: 'event' });
