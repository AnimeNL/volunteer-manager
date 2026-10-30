// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Chip from '@mui/material/Chip';

import { formatBytes } from '@app/admin/lib/formatBytes';

/**
 * Colours assigned to chips for particular services.
 */
const kServiceColours = {
    twilio: [ '#ffffff', '#f22f46' ],
};

/**
 * Cell that renders the service label in a colored chip.
 */
export function WebhookServiceCell({ row }: { row: { service: string } }) {
    if (!kServiceColours.hasOwnProperty(row.service))
        return <Chip label={row.service} size="small" />;

    const [ color, backgroundColor ] =
        kServiceColours[row.service as keyof typeof kServiceColours];

    const label =
        (row.service && row.service[0].toUpperCase() + row.service.slice(1)) || '';

    return <Chip label={label} size="small" sx={{ backgroundColor, color }} />;
}

/**
 * Cell that renders the size of the webhook payload in human-readable units.
 */
export function WebhookSizeCell({ row }: { row: { size: number } }) {
    return formatBytes(row.size);
}
