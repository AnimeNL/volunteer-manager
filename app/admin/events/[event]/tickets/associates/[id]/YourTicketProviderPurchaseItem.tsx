// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';

import type { Purchase, TicketDetails } from '@lib/tickets/Types';
import type { ServerAction } from '@lib/serverAction';
import type { TicketService } from '@lib/tickets/TicketService';
import { FormGrid } from '@app/admin/components/FormGrid';
import { QrCodeAction } from './QrCodeAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';

import { updateYourTicketProviderTicket } from '../../TicketActions';

/**
 * Props accepted by the <YourTicketProviderPurchaseItem> component.
 */
interface YourTicketProviderPurchaseItemProps {
    /**
     * URL-safe slug of the event this ticket is in scope of.
     */
    event: string;

    /**
     * Ticket Service through which changes could be mediated.
     */
    service: TicketService;

    /**
     * The ticket for which this component is being shown.
     */
    ticket: Purchase['tickets'][number];

    /**
     * Whether the ticket details can be updated by this volunteer.
     */
    readOnly: boolean;
}

/**
 * The <YourTicketProviderPurchaseItem> component provides the ability to display and make editable
 * the editable properties associated with an individual ticket.
 */
export async function YourTicketProviderPurchaseItem(props: YourTicketProviderPurchaseItemProps) {
    const ticketId = Number(props.ticket.id);
    const ticket = props.service.fetchTicketDetails(ticketId);

    const updateTicketFn =
        props.readOnly ? undefined
                       : updateYourTicketProviderTicket.bind(null, props.event, ticketId);

    return (
        <Section icon={ <ConfirmationNumberOutlinedIcon /> } title={`Ticket ${props.ticket.id}`}
                 headerAction={ <QrCodeAction barcode={props.ticket.barcode} /> }>
            { !!props.ticket.ticketName &&
                <SectionIntroduction>
                    {props.ticket.ticketName} issued through YourTicketProvider.
                </SectionIntroduction> }
            <Suspense fallback={ <SectionLoading /> }>
                <YourTicketProviderPurchaseItemForm action={updateTicketFn}
                                                    ticket={ticket} />
            </Suspense>
        </Section>
    );
}

/**
 * Props accepted by the <YourTicketProviderPurchaseItemForm> component.
 */
interface YourTicketProviderPurchaseItemFormProps {
    /**
     * Server Action through which the ticket can be updated, when allowed.
     */
    action: ServerAction<{
        TicketHolderFirstname: string;
        TicketHolderLastname: string;
        TicketHolderEmail: string;
    }> | undefined;

    /**
     * Detailed information about the ticket obtained from our ticketing partner.
     */
    ticket: Promise<TicketDetails | null>;
}

/**
 * The <YourTicketProviderPurchaseItemForm> component
 */
async function YourTicketProviderPurchaseItemForm(props: YourTicketProviderPurchaseItemFormProps) {
    const ticket = await props.ticket;
    if (!ticket) {
        return (
            <Alert severity="error" variant="outlined">
                Unable to fetch ticket information from YourTicketProvider.
            </Alert>
        );
    }

    const defaultValues = {
        TicketHolderFirstname: ticket.firstName,
        TicketHolderLastname: ticket.lastName,
        TicketHolderEmail: ticket.email,
    };

    const readOnly = !props.action;
    return (
        <FormGrid action={props.action!} defaultValues={defaultValues} callToAction="Update ticket">
            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="TicketHolderFirstname" label="First name" required
                                  fullWidth size="small" slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="TicketHolderLastname" label="Last name" required fullWidth
                                  size="small" slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="TicketHolderEmail" label="E-mail address" required fullWidth
                                  type="email" size="small" slotProps={{ input: { readOnly } }} />
            </Grid>
            { /* TODO: Display name? */ }
            { /* TODO: Team? */ }
            { /* TODO: Function? */ }
        </FormGrid>
    );
}
