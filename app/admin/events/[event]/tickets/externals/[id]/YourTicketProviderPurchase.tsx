// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';

import type { Purchase } from '@lib/tickets/Types';
import type { ServerAction } from '@lib/serverAction';
import type { TicketService } from '@lib/tickets/TicketService';
import type { TicketingPurchaseResponse } from '@lib/integrations/yourticketprovider/YourTicketProviderTypes';
import type { YourTicketProviderClient } from '@lib/integrations/yourticketprovider';
import { Cache } from '@lib/cache';
import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';

import { updateYourTicketProviderPurchase } from '../../TicketActions';

/**
 * Props accepted by the <YourTicketProviderPurchase> component.
 */
interface YourTicketProviderPurchaseProps {
    /**
     * URL-safe slug of the event this purchase is in scope of.
     */
    event: string;

    /**
     * Ticket Service through which changes could be mediated.
     */
    service: TicketService;

    /**
     * Unique ID of the purchase that's in scope.
     */
    purchaseId: Purchase['id'];

    /**
     * Whether the purchase details can be updated by this volunteer.
     */
    readOnly: boolean;
}

/**
 * The <YourTicketProviderPurchase> component provides the ability to display and make editable the
 * e-mail address associated with a purchase. Useful in case it has to be updated for a new owner.
 */
export async function YourTicketProviderPurchase(props: YourTicketProviderPurchaseProps) {
    const client = props.service.client as YourTicketProviderClient;

    const purchaseId = Number(props.purchaseId);

    const cache = Cache.getInstance('EventPurchaseCache');
    const purchase = cache.getOrInsert(purchaseId, async () => client.getPurchase(purchaseId));

    const updatePurchaseFn =
            props.readOnly ? undefined
                           : updateYourTicketProviderPurchase.bind(null, props.event, purchaseId);

    return (
        <Section icon={ <ReceiptOutlinedIcon /> } title="Purchase">
            <SectionIntroduction>
                The YourTicketProvider purchase that contains one or more tickets.
            </SectionIntroduction>
            <Suspense fallback={ <SectionLoading /> }>
                <YourTicketProviderPurchaseForm action={updatePurchaseFn} purchase={purchase} />
            </Suspense>
        </Section>
    );
}

/**
 * Props accepted by the <YourTicketProviderPurchaseForm> component.
 */
interface YourTicketProviderPurchaseFormProps {
    /**
     * Server Action through which the purchase can be updated, when allowed.
     */
    action: ServerAction<Partial<TicketingPurchaseResponse>> | undefined;

    /**
     * Detailed information about the purchase obtained from our ticketing partner.
     */
    purchase: Promise<TicketingPurchaseResponse | null>;
}

/**
 * The <YourTicketProviderPurchaseForm> component allows properties regarding the purchase to be
 * edited in the portal. They're fetched in real time from YourTicketProvider.
 */
async function YourTicketProviderPurchaseForm(props: YourTicketProviderPurchaseFormProps) {
    const purchase = await props.purchase;
    if (!purchase) {
        return (
            <Alert severity="error" variant="outlined">
                Unable to fetch purchase information from YourTicketProvider.
            </Alert>
        );
    }

    const defaultValues = {
        Email: purchase.Email,
    };

    const readOnly = !props.action;
    return (
        <FormGrid action={props.action!} defaultValues={defaultValues}
                  callToAction="Update purchase">
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="Email" label="E-mail address" required
                                  fullWidth size="small" slotProps={{ input: { readOnly } }} />
            </Grid>
        </FormGrid>
    );
}
