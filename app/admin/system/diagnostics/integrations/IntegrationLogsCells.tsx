// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';

import type { IntegrationLogStatus, IntegrationLogTarget } from '@lib/database/Types';
import { Chip } from '@app/admin/components/Chip';

import { kIntegrationLogStatus, kIntegrationLogTarget } from '@lib/database/Types';

/**
 * Colours assigned to chips for each integration target.
 */
const kIntegrationColours: { [k in IntegrationLogTarget]: string } = {
    [kIntegrationLogTarget.AnimeCon]: '#00897b',
    [kIntegrationLogTarget.GenAI]: '#8e24aa',
    [kIntegrationLogTarget.Weeztix]: '#1e88e5',
    [kIntegrationLogTarget.YourTicketProvider]: '#d81b60',
};

/**
 * Cell that renders the integration target in a coloured chip.
 */
export function IntegrationCell(props: { row: { integration: IntegrationLogTarget } }) {
    const color = kIntegrationColours[props.row.integration] ?? '#607d8b';
    return <Chip color={color} label={props.row.integration} />;
}

/**
 * Header component for the integration call status column.
 */
export function StatusHeader() {
    return (
        <Tooltip title="Was the integration call successful?">
            <TaskAltIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell that renders an icon indicating whether the integration call succeeded, failed, or threw an
 * exception.
 */
export function StatusCell(props: { row: { status: IntegrationLogStatus } }) {
    switch (props.row.status) {
        case kIntegrationLogStatus.Success:
            return (
                <Tooltip title="The call succeeded">
                    <TaskAltIcon color="success" fontSize="small" />
                </Tooltip>
            );

        case kIntegrationLogStatus.Failure:
            return (
                <Tooltip title="The call returned a failure response">
                    <ErrorOutlinedIcon color="error" fontSize="small" />
                </Tooltip>
            );

        case kIntegrationLogStatus.Exception:
            return (
                <Tooltip title="The call threw an exception">
                    <ErrorOutlinedIcon color="error" fontSize="small" />
                </Tooltip>
            );
    }
}
