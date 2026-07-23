// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import DisabledVisibleOutlinedIcon from '@mui/icons-material/DisabledVisibleOutlined';
import NoAccountsOutlinedIcon from '@mui/icons-material/NoAccountsOutlined';
import ShareIcon from '@mui/icons-material/Share';
import Tooltip from '@mui/material/Tooltip';
import UpdateDisabledIcon from '@mui/icons-material/UpdateDisabled';

import { formatDate } from '@lib/Temporal';

/**
 * Cell that displays an icon to indicate why the export no longer is available. A fair amount of
 * granularity is included to provide, at a quick glance, the reason for its inavailability.
 */
export function ExportAvailabilityCell({ row }: {
    row: {
        enabled: boolean,
        expirationDate: string,
        views: number,
        expirationViews: number
    }
}) {
    const now = Temporal.Now.zonedDateTimeISO('UTC');
    const expiration = Temporal.ZonedDateTime.from(row.expirationDate);

    if (!row.enabled) {
        return (
            <Tooltip title="This export has been manually revoked">
                <NoAccountsOutlinedIcon fontSize="small" color="disabled" />
            </Tooltip>
        );
    }

    if (row.views >= row.expirationViews) {
        return (
            <Tooltip title={`Reached view limit of ${row.expirationViews} view(s)`}>
                <DisabledVisibleOutlinedIcon fontSize="small" color="disabled" />
            </Tooltip>
        );
    }

    if (Temporal.ZonedDateTime.compare(now, expiration) >= 0) {
        return (
            <Tooltip title={`Expired on ${formatDate(expiration, 'YYYY-MM-DD')}`}>
                <UpdateDisabledIcon fontSize="small" color="disabled" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="This export is active and can be accessed">
            <ShareIcon fontSize="small" color="success" />
        </Tooltip>
    );
}
