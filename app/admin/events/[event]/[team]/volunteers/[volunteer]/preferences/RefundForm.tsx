// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

/**
 * Props accepted by the <RefundForm> component.
 */
interface RefundFormProps {
    /**
     * Whether form fields should be rendered in read-only mode.
     */
    readOnly?: boolean;
}

/**
 * Form through which a volunteer's refund request can be managed.
 */
export function RefundForm(props: RefundFormProps) {
    const { readOnly } = props;
    return (
        <>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="accountName" label="Bank account name" size="small" required
                                  fullWidth multiline slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="accountIban" label="Bank account IBAN" size="small" required
                                  fullWidth multiline slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="ticketNumber" label="Ticket or order number (when known)"
                                  size="small" fullWidth multiline
                                  slotProps={{ input: { readOnly } }} />
            </Grid>
        </>
    );
}
