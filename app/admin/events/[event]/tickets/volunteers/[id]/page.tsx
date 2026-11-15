// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';

import { ActionBar } from '@app/admin/components/ActionBar';
import { CancelPurchaseQuickAction } from '../../associates/[id]/CancelPurchaseQuickAction';
import { QuickActionButton } from '@app/admin/components/QuickActionButton';
import { ResendConfirmationQuickAction } from '../../associates/[id]/ResendConfirmationQuickAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents } from '@lib/database';

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

    const userId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    const dbInstance = db;

    const participation = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.userId.equals(userId))
        .select({
            user: {
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            },
        })
        .executeSelectNoneOrOne();

    if (!participation)
        notFound();

    const service = await createTicketService(event.id);
    const ticketInfo = service
        ? (await service.listVolunteerTickets(event.id, [ userId ])).get(userId)
        : undefined;

    const purchaseId = ticketInfo?.purchaseId;

    // ---------------------------------------------------------------------------------------------

    const hasAssociatedTicket = !!purchaseId;

    const canDeleteTickets = access.can('volunteers.tickets', 'delete', { event: event.slug });
    const canUpdateTickets = access.can('volunteers.tickets', 'update', { event: event.slug });
    const canCancelPurchases = !!service?.canCancelPurchases() && canDeleteTickets;

    const cancelPurchaseFn =
        canCancelPurchases && !!purchaseId
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
                { !purchaseId &&
                    <Alert severity="warning" variant="outlined">
                        {participation.user.firstName} has not been issued a ticket for{' '}
                        {event.shortName} yet.
                    </Alert> }
                { !!ticketInfo?.cancelled &&
                    <Alert severity="error" variant="outlined">
                        {participation.user.firstName} has been issued a ticket that has
                        inadvertently been cancelled.
                        { canUpdateTickets && ' You need to disassociate their ticket below.' }
                    </Alert> }
                { ((canCancelPurchases || canUpdateTickets) && hasAssociatedTicket) &&
                    <ActionBar>
                        { canUpdateTickets &&
                            <QuickActionButton
                                action={disassociateFn}
                                icon={ <PersonRemoveOutlinedIcon /> }
                                label="Disassociate"
                                submitLabel="Disassociate"
                                title="Disassociate this ticket?"
                                description={
                                    <>
                                        This action will return the ticket to the{' '}
                                        <em>associate</em> pool—it may continue to be valid for
                                        entry, but won't be associated with this volunteer anymore.
                                    </>
                                } /> }
                        { canUpdateTickets &&
                            <ResendConfirmationQuickAction action={resendConfirmationFn} /> }
                        { canCancelPurchases &&
                            <CancelPurchaseQuickAction action={cancelPurchaseFn} /> }
                    </ActionBar> }
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Volunteers', 'Tickets', { event: 'event' });
