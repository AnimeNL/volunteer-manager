// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionBar } from '@app/admin/components/ActionBar';
import { AssociateQuickAction } from './AssociateQuickAction';
import { CancelPurchaseQuickAction } from './CancelPurchaseQuickAction';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { QrCode } from '@components/QrCode';
import { ResendConfirmationQuickAction } from './ResendConfirmationQuickAction';
import { Section } from '@app/admin/components/Section';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tUsers, tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { associatePurchase, cancelPurchase, resendPurchaseConfirmation } from '../../TicketActions';

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

    const eventTicketTypes = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            guestTicketGuid: tEvents.eventWeeztixGuestTicketGuid,
            vendorTicketGuid: tEvents.eventWeeztixVendorTicketGuid,
            volunteerTicketGuid: tEvents.eventWeeztixVolunteerTicketGuid,
        })
        .executeSelectNoneOrOne();

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
                         : undefined!;

    const cancelPurchaseFn =
        canCancelPurchases ? cancelPurchase.bind(null, event.slug, purchase.id)
                           : undefined!;

    const resendConfirmationFn =
        canUpdateTickets ? resendPurchaseConfirmation.bind(null, event.slug, purchase.id)
                         : undefined!;

    const formattedPurchaseId = service.formatPurchaseId(purchase.id);
    const pageTitle = purchase.name || formattedPurchaseId;

    const headerSection = (
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
    );

    if (!purchase.tickets.length) {
        return (
            <>
                {headerSection}
                <Alert severity="error" variant="filled">
                    This purchase does not contain any tickets.
                </Alert>
            </>
        );
    }

    const ticket = purchase.tickets[0];
    const ticketIdStr = `${ticket.ticketId}`;

    let ticketType = ticket.ticketName ?? 'Unknown';
    if (ticketIdStr === eventTicketTypes?.guestTicketGuid)
        ticketType = 'Guest';
    else if (ticketIdStr === eventTicketTypes?.vendorTicketGuid)
        ticketType = 'Vendor';
    else if (ticketIdStr === eventTicketTypes?.volunteerTicketGuid ||
             ticketIdStr === event.tickets?.volunteerTicketId)
        ticketType = 'Volunteer';

    return (
        <>
            {headerSection}
            <Section noHeader back tabs>
                { purchase.tickets.length > 1 &&
                    <Alert severity="warning" variant="standard">
                        This purchase contains {purchase.tickets.length} tickets; only the first
                        ticket is shown below.
                    </Alert> }
                { !containsVolunteerTicket &&
                    <Alert severity="warning" variant="outlined">
                        This purchase does not contain any volunteer tickets.
                    </Alert> }
                { ((canCancelPurchases || canUpdateTickets) && !hasBeenCancelled) &&
                    <ActionBar>
                        { canUpdateTickets &&
                            <AssociateQuickAction action={associatePurchaseFn}
                                                  ticketProvider={service.id}
                                                  volunteers={associateVolunteers} /> }
                        { canUpdateTickets &&
                            <ResendConfirmationQuickAction action={resendConfirmationFn} /> }
                        { canCancelPurchases &&
                            <CancelPurchaseQuickAction action={cancelPurchaseFn} /> }
                    </ActionBar> }
                { !!hasBeenCancelled &&
                    <Alert severity="error" variant="outlined">
                        This ticket has been cancelled and is no longer valid for entry.
                    </Alert> }
                <KeyValueList items={[
                    {
                        key: 'Ticket type',
                        value: ticketType,
                    },
                    {
                        key: 'Ticket holder',
                        value: ticket.holder || 'Unknown',
                    },
                    {
                        condition: !!ticket.nickname,
                        key: 'Nickname',
                        value: ticket.nickname,
                    },
                    {
                        key: 'Function',
                        value: ticket.function || 'Unknown',
                    },
                    {
                        key: 'Organisation',
                        value: ticket.organisation || 'Unknown',
                    },
                    {
                        condition: !!purchase.created,
                        key: 'Created',
                        valueTemplate: 'localDateTime',
                        value: purchase.created?.toString(),
                    },
                    {
                        condition: !!purchase.updated,
                        key: 'Updated',
                        valueTemplate: 'localDateTime',
                        value: purchase.updated?.toString(),
                    },
                ]} />
            </Section>
            <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Paper sx={{ p: 1.5, pb: ticket.barcode ? 0 : 1.5 }}>
                        <SectionHeader icon={ <ConfirmationNumberOutlinedIcon /> }
                                       title={`Ticket ${service.formatTicketId(ticket.id)}`}
                                       sx={{ pb: 1.5 }} />
                        <Stack direction="column" spacing={0.5}>
                            { !!ticket.ticketName &&
                                <Typography variant="subtitle2" noWrap>
                                    {ticket.ticketName}
                                </Typography> }
                            { !!ticket.holder &&
                                <Typography variant="body2" noWrap>
                                    {ticket.holder}
                                </Typography> }
                            { !!ticket.nickname &&
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    <strong>Nickname</strong>: {ticket.nickname}
                                </Typography> }
                            { !!ticket.barcode &&
                                <Box sx={{ pt: 1 }}>
                                    <QrCode content={ticket.barcode} />
                                </Box> }
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Purchase #' }, 'Associates', 'Tickets',
                             { event: 'event' });
