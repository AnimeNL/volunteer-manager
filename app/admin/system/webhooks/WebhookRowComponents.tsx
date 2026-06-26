// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Chip from '@mui/material/Chip';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import VerifiedIcon from '@mui/icons-material/Verified';

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
 * Size units used to display the size of a received message.
 */
const kMessageSizeUnit = [ 'bytes', 'KiB', 'MiB', 'GiB' ];

/**
 * Cell that renders the size of the webhook payload in human-readable units.
 */
export function WebhookSizeCell({ row }: { row: { size: number } }) {
    let size = row.size;
    let unitIndex = 0;

    while (size >= 1024) {
        size /= 1024;
        unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${ kMessageSizeUnit[unitIndex] ?? 'TiB' }`;
}

/**
 * Header component for the authenticated column.
 */
export function WebhookAuthenticatedHeader() {
    return (
        <Tooltip title="Could the call be authenticated?">
            <VerifiedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell that renders an icon indicating authentication status.
 */
export function WebhookAuthenticatedCell({ row }: { row: { authenticated?: boolean | null } }) {
    if (!!row.authenticated) {
        return (
            <Tooltip title="Authentication was successful">
                <TaskAltIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else if (row.authenticated === null || row.authenticated === undefined) {
        return (
            <Tooltip title="No authentication was attempted">
                <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="The call could not be authenticated">
                <ErrorOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}
