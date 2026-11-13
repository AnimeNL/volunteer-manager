// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header cell for the outgoing e-mail usage column.
 */
export function OutgoingHeader() {
    return (
        <Tooltip title="Is this account used for outgoing messages?">
            <OutboxOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell rendering an icon indicating whether the e-mail account is used for outgoing messages, and
 * if so, whether as the default account and/or by specific teams.
 */
export function OutgoingCell({ row }: { row: { isDefault: boolean; teams: string[] } }) {
    if (!row.isDefault && !row.teams.length) {
        return (
            <Tooltip title="Not used for outgoing messages">
                <OutboxOutlinedIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    }

    let title: string;
    if (row.isDefault && row.teams.length > 0)
        title = `Default outgoing account; also used by ${row.teams.join(', ')}`;
    else if (row.isDefault)
        title = 'Default outgoing account';
    else
        title = `Used for outgoing messages by ${row.teams.join(', ')}`;

    return (
        <Tooltip title={title}>
            <OutboxOutlinedIcon color="success" fontSize="small" />
        </Tooltip>
    );
}
