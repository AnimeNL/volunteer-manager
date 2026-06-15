// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

/**
 * Cell that renders a link to view the Twilio message details.
 */
export function TwilioIdCell({ row, context }: { row: { id: number }; context?: { type: string } })
{
    const type = context?.type.toLowerCase() ?? 'sms';
    return (
        <MuiLink component={Link} href={`/admin/system/outbox/${type}/${row.id}`} sx={{ pt: 0.5 }}>
            <ReadMoreIcon color="info" />
        </MuiLink>
    );
}

/**
 * Cell that renders an icon indicating delivery success or failure.
 */
export function TwilioDeliveredCell({ row }: { row: { delivered: boolean } }) {
    return row.delivered ? <CheckCircleIcon fontSize="small" color="success" />
                         : <CancelIcon fontSize="small" color="error" />;
}
