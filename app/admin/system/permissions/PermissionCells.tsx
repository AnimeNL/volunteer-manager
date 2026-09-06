// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import Chip from '@mui/material/Chip';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header for the column that indicates whether a permission is dangerous.
 */
export function DangerousHeader() {
    return (
        <Tooltip title="Is this a dangerous permission?">
            <WarningOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell to visualise whether a permission is considered dangerous.
 */
export function DangerousCell(props: { row: { warning?: boolean } }) {
    if (props.row.warning === true) {
        return (
            <Tooltip title="Dangerous permission">
                <WarningOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    } else if (props.row.warning === false) {
        return (
            <Tooltip title="Standard permission">
                <CheckCircleOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }

    return null;
}

/**
 * Cell to visualise enabled CRUD operations, or a dash when not applicable.
 */
export function OperationsCell(props: { row: { operations?: string[]; type?: string } }) {
    if (props.row.type !== 'CRUD') {
        return (
            <Tooltip title="Not applicable for Boolean permissions">
                <span style={{ color: 'var(--mui-palette-text-disabled)' }}>n/a</span>
            </Tooltip>
        );
    }

    if (!props.row.operations || props.row.operations.length === 0)
        return <Chip color="error" label="undefined" size="small" />;

    return props.row.operations.join(', ');
}

