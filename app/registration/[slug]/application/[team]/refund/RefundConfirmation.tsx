// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Typography from '@mui/material/Typography';

import { ConfirmationBox } from '../hotel/ConfirmationBox';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <RefundConfirmation> component.
 */
interface RefundConfirmationProps {
    /**
     * The refund request that we're displaying a confirmation for, if any.
     */
    refund?: {
        ticketNumber?: string;
        accountIban: string;
        accountName: string;

        requested: string;
        confirmed?: string;
    };
}

/**
 * The <RefundConfirmation> component displays the status of a refund request that the volunteer has
 * submitted, differentiating between a requested refund and an issued refund.
 */
export function RefundConfirmation(props: RefundConfirmationProps) {
    if (!props.refund || !props.refund.requested)
        return undefined;

    const requested = Temporal.ZonedDateTime.from(props.refund.requested);
    const secondary: string =
        `You requested the refund on ${formatDate(requested, 'dddd, MMMM D')}.`;

    let primary: string = '';
    let tertiary: string | undefined;

    if (!!props.refund.confirmed) {
        const confirmed = Temporal.ZonedDateTime.from(props.refund.confirmed);
        primary = 'Your refund has been confirmed!';
        tertiary = `We issued the refund on ${formatDate(confirmed, 'dddd, MMMM D')}.`;
    } else {
        primary = 'Your request has been received';
    }

    return (
        <>
            <Typography variant="h5" sx={{ mt: 1 }}>
                Your ticket refund request
            </Typography>
            <ConfirmationBox primary={primary} secondary={secondary} tertiary={tertiary} />
        </>
    );
}
