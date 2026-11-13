// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header cell for the thread resolution status column.
 */
export function ThreadStateHeader() {
    return (
        <Tooltip title="Thread status">
            <InboxOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell rendering an icon that visualises whether an inbox thread is resolved ("Done") or still
 * awaiting action ("Pending response").
 */
export function ThreadStateCell({ row }: { row: { resolved: boolean } }) {
    if (row.resolved) {
        return (
            <Tooltip title="Done">
                <CheckCircleOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="Pending response">
            <MarkEmailUnreadOutlinedIcon color="warning" fontSize="small" />
        </Tooltip>
    );
}
