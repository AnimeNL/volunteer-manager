// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';

import type { CachedEvent } from '@lib/cache';
import type { Purchase } from '@lib/tickets/Types';
import type { ServerAction } from '@lib/serverAction';
import type { TicketService } from '@lib/tickets/TicketService';
import { ActionBar } from '@app/admin/components/ActionBar';
import { FormGrid } from '@app/admin/components/FormGrid';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { PurchaseIdLink } from './PurchaseIdLink';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TicketQrAction } from './TicketQrAction';
import db, { tEvents } from '@lib/database';

/**
 * Props accepted by the <PurchaseDetails> component.
 */
export interface PurchaseDetailsProps {
    /**
     * Quick actions to display in the action bar, if any.
     */
    actions?: React.ReactNode;

    /**
     * Additional alerts to display at the top of the purchase section.
     */
    alerts?: React.ReactNode;

    /**
     * Additional content to display between the purchase summary and the ticket details section.
     */
    children?: React.ReactNode;

    /**
     * Event for which the purchase is being displayed.
     */
    event: CachedEvent;

    /**
     * Purchase details fetched from the ticketing service.
     */
    purchase: Purchase;

    /**
     * Whether the ticket details section should be rendered in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Ticket service instance for formatting IDs and creating provider links.
     */
    service: TicketService;

    /**
     * Optional warning or notice to display in the ticket section.
     */
    ticketWarning?: React.ReactNode;

    /**
     * Server action to invoke when updating the ticket details. When omitted and `readOnly` is
     * false, the ticket details section will not be rendered.
     */
    updateTicketAction?: ServerAction<any>;
}

/**
 * Shared component that displays the details, quick actions, and ticket information for a ticket
 * purchase. Used by both the associate and volunteer ticket detail pages.
 */
export async function PurchaseDetails(props: PurchaseDetailsProps) {
    const { event, purchase, readOnly, service } = props;

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

    const showTicketSection = readOnly || !!props.updateTicketAction;

    return (
        <>
            <Section noHeader back tabs>
                { purchase.tickets.length > 1 &&
                    <Alert severity="warning" variant="standard">
                        This purchase contains {purchase.tickets.length} tickets; only the first
                        ticket is shown below.
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
            {props.children}
            { showTicketSection &&
                <Section icon={ <ConfirmationNumberOutlinedIcon /> } title="Ticket"
                         headerAction={
                             !!ticket.barcode &&
                             <TicketQrAction barcode={ticket.barcode}
                                             title={`Ticket ${service.formatTicketId(ticket.id)}`} />
                         }>
                    { !readOnly &&
                        <SectionIntroduction>
                            Changes made here will be reflected in the real ticket immediately.
                        </SectionIntroduction> }
                    {props.ticketWarning}
                    <FormGrid action={props.updateTicketAction!} defaultValues={{
                        holder: ticket.holder ?? '',
                        nickname: ticket.nickname ?? '',
                        function: ticket.function ?? '',
                        organisation: ticket.organisation ?? '',
                    }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="holder" label="Ticket holder"
                                              required={!readOnly} fullWidth size="small"
                                              slotProps={{ input: { readOnly: !!readOnly } }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="nickname" label="Nickname"
                                              fullWidth size="small"
                                              slotProps={{ input: { readOnly: !!readOnly } }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="function" label="Function"
                                              required={!readOnly} fullWidth size="small"
                                              slotProps={{ input: { readOnly: !!readOnly } }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="organisation" label="Organisation"
                                              required={!readOnly} fullWidth size="small"
                                              slotProps={{ input: { readOnly: !!readOnly } }} />
                        </Grid>
                    </FormGrid>
                </Section> }
        </>
    );
}
