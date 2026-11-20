// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import TextField from '@mui/material/TextField';

import type { ServerAction } from '@lib/serverAction';
import type { TicketService } from '@lib/tickets/TicketService';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';

/**
 * Props accepted by the <AssociateOrderSection> component.
 */
interface AssociateOrderSectionProps {
    /**
     * Server Action through which the order's e-mail address can be updated, when allowed.
     */
    action?: ServerAction<{ email: string }>;

    /**
     * Unique ID of the purchase/order whose details should be fetched.
     */
    purchaseId: number | string;

    /**
     * Ticket service instance used to fetch live order details.
     */
    service: TicketService;
}

/**
 * Displays the "Order" section on the associate ticket page, streaming live order details from the
 * ticketing provider inside a `<Suspense>` boundary.
 */
export function AssociateOrderSection(props: AssociateOrderSectionProps) {
    return (
        <Section icon={ <ReceiptOutlinedIcon /> } title="Order">
            <SectionIntroduction>
                The name associated with the order will automatically update to match the ticket
                holder.
            </SectionIntroduction>
            <Suspense fallback={ <SectionLoading /> }>
                <AssociateOrderDetails
                    action={props.action}
                    purchaseId={props.purchaseId}
                    service={props.service} />
            </Suspense>
        </Section>
    );
}

/**
 * Fetches live order details from the ticketing provider and renders either an editable form or a
 * read-only field depending on the reader's permissions.
 */
async function AssociateOrderDetails(props: AssociateOrderSectionProps) {
    const details = await props.service.fetchPurchaseDetails(props.purchaseId);
    if (!details) {
        return (
            <Alert severity="error" variant="outlined">
                Unable to fetch order information from {props.service.id}.
            </Alert>
        );
    }

    if (!props.action) {
        return (
            <TextField label="E-mail address" value={details.email ?? ''} fullWidth size="small"
                       slotProps={{ input: { readOnly: true } }} />
        );
    }

    return (
        <FormGrid action={props.action} defaultValues={{ email: details.email ?? '' }}>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="email" label="E-mail address" type="email" required
                                  fullWidth size="small" />
            </Grid>
        </FormGrid>
    );
}
