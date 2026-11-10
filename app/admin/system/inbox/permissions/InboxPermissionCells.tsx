// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import InboxIcon from '@mui/icons-material/Inbox';
import MailLockOutlinedIcon from '@mui/icons-material/MailLockOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header cell for the inbox eligibility column.
 */
export function EligibilityHeader() {
    return (
        <Tooltip title="Are they eligible for inbox access?">
            <InboxIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell rendering an icon indicating whether the account is eligible for inbox access.
 */
export function EligibilityCell({ row }: { row: { eligible: boolean; inboxLabel: null | string } })
{
    if (!row.eligible) {
        return (
            <Tooltip title="Not eligible for inbox access">
                <MailLockOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="Eligible for inbox access">
            <InboxIcon color={ !!row.inboxLabel ? 'success' : 'disabled' } fontSize="small" />
        </Tooltip>
    );
}
