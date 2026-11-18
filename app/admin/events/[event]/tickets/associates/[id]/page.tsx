// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { AssociateQuickAction } from './AssociateQuickAction';
import { CancelPurchaseQuickAction, ResendConfirmationQuickAction }
    from '../../PurchaseQuickActions';
import { FormGrid } from '@app/admin/components/FormGrid';
import { PurchaseSummary } from '../../PurchaseSummary';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TicketQrAction } from '../../TicketQrAction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { associatePurchase, cancelPurchase, resendPurchaseConfirmation,
    updateAssociateTicket } from '../../TicketActions';

/**
 * Page that provides insight in the ticket granted to an individual associate to our team.
 */
export default async function EventTicketsAssociatesPage(
    props: PageProps<'/admin/events/[event]/tickets/associates/[id]'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, {
        permission: 'volunteers.tickets',
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

    // ---------------------------------------------------------------------------------------------
    // Functionality: Associating the ticket with a volunteer
    // ---------------------------------------------------------------------------------------------

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

    const hasBeenCancelled = !!purchase.cancelled;

    const canDeleteTickets = access.can('volunteers.tickets', 'delete', { event: event.slug });
    const canUpdateTickets = access.can('volunteers.tickets', 'update', { event: event.slug });
    const canCancelPurchases = service.canCancelPurchases() && canDeleteTickets;

    const associatePurchaseFn =
        canUpdateTickets ? associatePurchase.bind(null, event.slug, purchase.id)
                         : undefined;

    const cancelPurchaseFn =
        canCancelPurchases ? cancelPurchase.bind(null, event.slug, purchase.id)
                           : undefined;

    const resendConfirmationFn =
        canUpdateTickets ? resendPurchaseConfirmation.bind(null, event.slug, purchase.id)
                         : undefined;

    const formattedPurchaseId = service.formatPurchaseId(purchase.id);
    const pageTitle = purchase.name || formattedPurchaseId;

    const ticket = purchase.tickets.at(0);
    const updateTicketFn =
        canUpdateTickets && ticket
            ? updateAssociateTicket.bind(null, event.slug, purchase.id, ticket.id)
            : undefined;

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> }
                     title={pageTitle} documentation="event/tickets"
                     limited={!canDeleteTickets || !canUpdateTickets}
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Associates',
                            href: `/admin/events/${event.slug}/tickets/associates`,
                        },
                        { label: pageTitle },
                     ]}>
                <SectionIntroduction>
                    Information about the ticket{purchase.tickets.length === 1 ? '' : 's'} issued
                    as part of this purchase for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <PurchaseSummary
                event={event}
                purchase={purchase}
                service={service}
                alerts={
                    !containsVolunteerTicket && (
                        <Alert severity="warning" variant="outlined">
                            This purchase does not contain any volunteer tickets.
                        </Alert>
                    )
                }
                actions={
                    (canCancelPurchases || canUpdateTickets) && !hasBeenCancelled && (
                        <>
                            { !!associatePurchaseFn &&
                                <AssociateQuickAction action={associatePurchaseFn}
                                                      ticketProvider={service.id}
                                                      volunteers={associateVolunteers} /> }
                            { !!resendConfirmationFn &&
                                <ResendConfirmationQuickAction action={resendConfirmationFn} /> }
                            { !!cancelPurchaseFn &&
                                <CancelPurchaseQuickAction action={cancelPurchaseFn} /> }
                        </>
                    )
                } />
            { (!!ticket && !!updateTicketFn) &&
                <Section icon={ <ConfirmationNumberOutlinedIcon /> } title="Ticket"
                         headerAction={
                             !!ticket.barcode &&
                             <TicketQrAction
                                 barcode={ticket.barcode}
                                 title={`Ticket ${service.formatTicketId(ticket.id)}`} />
                         }>
                    <SectionIntroduction>
                        Changes made here will be reflected in the real ticket immediately.
                    </SectionIntroduction>
                    <FormGrid action={updateTicketFn} defaultValues={{
                        holder: ticket.holder ?? '',
                        nickname: ticket.nickname ?? '',
                        function: ticket.function ?? '',
                        organisation: ticket.organisation ?? '',
                    }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="holder" label="Ticket holder" required
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="nickname" label="Nickname"
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="function" label="Function" required
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="organisation" label="Organisation" required
                                              fullWidth size="small" />
                        </Grid>
                    </FormGrid>
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Purchase #' }, 'Associates', 'Tickets',
                             { event: 'event' });
