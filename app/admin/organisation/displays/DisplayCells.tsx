// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Chip, { type ChipProps } from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatDuration } from '@lib/Temporal';

import { kDisplayHelpRequestStatus } from '@lib/database/Types';

/**
 * Component that renders the display's identifier as a chip, colour-coded based on when it last
 * checked in with our servers.
 */
export function DisplayIdentifierCell({ row }: {
    row: {
        identifier: string;
        lastCheckIn: string;
    };
}) {
    const currentTime = Temporal.Now.zonedDateTimeISO('utc');
    const checkIn = Temporal.ZonedDateTime.from(row.lastCheckIn);
    const difference = checkIn.until(currentTime, { largestUnit: 'seconds' });

    let color: ChipProps['color'];
    if (difference.seconds < /* 5 minutes= */ 300)
        color = 'success';
    else if (difference.seconds < /* 10 minutes= */ 600)
        color = 'warning';

    return <Chip color={color} label={row.identifier} size="small" />;
}

/**
 * Component that renders the display's label, or an italicised "Unprovisioned" note when no label
 * has been set yet, optionally warning if an event or location is configured.
 */
export function DisplayLabelCell({ row }: {
    row: {
        label?: string;
        eventId?: number;
        locationId?: number;
    };
}) {
    if (!!row.label)
        return row.label;

    return (
        <>
            <Typography component="span" variant="body2"
                        sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                Unprovisioned
            </Typography>
            { (!!row.eventId || !!row.locationId) &&
                <Tooltip title="The display cannot work without a name">
                    <ErrorOutlinedIcon fontSize="small" color="warning" sx={{ ml: 0.5 }} />
                </Tooltip> }
        </>
    );
}

/**
 * Component that renders the display's light bar colour as a chip with the colour as background.
 */
export function DisplayColorCell({ row }: {
    row: {
        color?: string;
    };
}) {
    if (!!row.color) {
        return (
            <Chip label={row.color} size="small"
                  sx={{ backgroundColor: row.color }} />
        );
    }

    return (
        <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
            …
        </Typography>
    );
}

/**
 * Component that renders the help request status for a display, if any is active.
 */
export function DisplayHelpRequestStatusCell({ row }: {
    row: {
        helpRequestStatus?: string;
    };
}) {
    switch (row.helpRequestStatus) {
        case kDisplayHelpRequestStatus.Pending:
            return (
                <Tooltip title="The request has been issued">
                    <Chip label="Pending" color="error" size="small" />
                </Tooltip>
            );

        case kDisplayHelpRequestStatus.Acknowledged:
            return (
                <Tooltip title="The request has been acknowledged">
                    <Chip label="Acknowledged" color="warning" size="small" />
                </Tooltip>
            );

        default:
            return (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    …
                </Typography>
            );
    }
}

/**
 * Component that renders the relative duration since the display last checked in, with the IP
 * address stored in a tooltip.
 */
export function DisplayLastCheckInCell({ row }: {
    row: {
        lastCheckIn: string;
        lastCheckInIp: string;
    };
}) {
    const currentTime = Temporal.Now.zonedDateTimeISO('utc');
    const checkIn = Temporal.ZonedDateTime.from(row.lastCheckIn);
    const difference = checkIn.since(currentTime, { largestUnit: 'days' });

    return (
        <Tooltip title={row.lastCheckInIp}>
            <Typography component="span" variant="body2">
                { formatDuration(difference) }
            </Typography>
        </Tooltip>
    );
}

/**
 * Header icon component for the locked column.
 */
export function DisplayLockedHeader() {
    return (
        <Tooltip title="Is the device locked?">
            <LockIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Component that renders whether the display is locked with a green lock or red open lock icon.
 */
export function DisplayLockedCell({ row }: {
    row: {
        locked: boolean;
    };
}) {
    if (!!row.locked) {
        return (
            <Tooltip title="Device is locked">
                <LockIcon fontSize="small" color="success" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Device is unlocked">
                <LockOpenIcon fontSize="small" color="error" />
            </Tooltip>
        );
    }
}
