// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';

import type { CachedEvent } from '@lib/cache';
import type { Purchase } from '@lib/tickets/Types';
import type { TicketService } from '@lib/tickets/TicketService';
import { ActionBar } from '@app/admin/components/ActionBar';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { PurchaseIdLink } from './PurchaseIdLink';
import { Section } from '@app/admin/components/Section';
import db, { tEvents } from '@lib/database';

/**
 * Props accepted by the <PurchaseSummary> component.
 */
export interface PurchaseSummaryProps {
    /**
     * Quick actions to display in the action bar, if any.
     */
    actions?: React.ReactNode;

    /**
     * Additional alerts to display at the top of the purchase section.
     */
    alerts?: React.ReactNode;

    /**
     * Event for which the purchase is being displayed.
     */
    event: CachedEvent;

    /**
     * Purchase details fetched from the ticketing service.
     */
    purchase: Purchase;

    /**
     * Ticket service instance for creating provider links.
     */
    service: TicketService;

    /**
     * Information about the volunteer holding this ticket, when applicable.
     */
    ticketHolder?: {
        href?: string;
        name: string;
    };
}

/**
 * Shared component that displays the high-level summary, alerts, and quick actions for a ticket
 * purchase. Used by both the associate and volunteer ticket detail pages.
 */
export async function PurchaseSummary(props: PurchaseSummaryProps) {
    const { event, purchase, service } = props;

    if (!purchase.tickets.length) {
        return (
            <Alert severity="error" variant="filled">
                This purchase does not contain any tickets.
            </Alert>
        );
    }

    const eventTicketTypes = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            guestTicketGuid: tEvents.eventWeeztixGuestTicketGuid,
            vendorTicketGuid: tEvents.eventWeeztixVendorTicketGuid,
            volunteerTicketGuid: tEvents.eventWeeztixVolunteerTicketGuid,
        })
        .executeSelectNoneOrOne();

    const hasBeenCancelled = !!purchase.cancelled;
    const purchaseLink = service.createPurchaseLink(purchase.id);

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
        <Section noHeader back tabs>
            { purchase.tickets.length > 1 &&
                <Alert severity="warning" variant="standard">
                    This purchase contains {purchase.tickets.length} tickets; only the first ticket
                    is shown below.
                </Alert> }
            {props.alerts}
            { !!props.actions &&
                <ActionBar>
                    {props.actions}
                </ActionBar> }
            { hasBeenCancelled &&
                <Alert severity="error" variant="outlined">
                    This ticket has been cancelled and is no longer valid for entry.
                </Alert> }
            <KeyValueList items={[
                {
                    key: 'Order',
                    valueTemplate: 'component',
                    value: <PurchaseIdLink href={purchaseLink} label={purchase.id} />,
                },
                {
                    key: 'Ticket type',
                    value: ticketType,
                },
                {
                    condition: !!props.ticketHolder,
                    key: 'Ticket holder',
                    value: props.ticketHolder?.href
                        ? (
                            <MuiLink component={Link} href={props.ticketHolder.href}>
                                {props.ticketHolder.name}
                            </MuiLink>
                        )
                        : props.ticketHolder?.name,
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
    );
}
