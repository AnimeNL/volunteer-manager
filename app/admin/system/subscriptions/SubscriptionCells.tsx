// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import AlarmIcon from '@mui/icons-material/Alarm';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header cell for the eligibility column.
 */
export function EligibilityHeader() {
    return (
        <Tooltip title="Are they eligible for subscriptions?">
            <AlarmIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell rendering an icon indicating whether the account is eligible for subscriptions.
 */
export function EligibilityCell({ row }: { row: { eligible: boolean, subscriptionCount: number } })
{
    if (!row.eligible) {
        return (
            <Tooltip title="Not eligible for subscriptions">
                <AlarmOffIcon color="error" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Eligible for subscriptions">
                <AlarmIcon color={ row.subscriptionCount > 0 ? 'success' : 'disabled' }
                           fontSize="small" />
            </Tooltip>
        );
    }
}
