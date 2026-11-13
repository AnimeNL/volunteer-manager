// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MailLockOutlinedIcon from '@mui/icons-material/MailLockOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
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
