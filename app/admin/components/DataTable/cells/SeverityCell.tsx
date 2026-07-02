// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import Tooltip from '@mui/material/Tooltip';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import type { LogSeverity, MutationSeverity } from '@lib/database/Types';

/**
 * Header component for the severity column.
 */
export function SeverityHeader() {
    return (
        <Tooltip title="Severity">
            <InfoOutlinedIcon color="primary" />
        </Tooltip>
    );
}

/**
 * Props accepted by the <SeverityCell> component.
 */
interface SeverityCellProps {
    /**
     * The row that should be rendered.
     */
    row: {
        /**
         * The severity to display.
         */
        severity: LogSeverity | MutationSeverity | string;
    };
}

/**
 * Component to display a severity icon.
 */
export function SeverityCell(props: SeverityCellProps) {
    let icon: React.ReactElement | undefined;
    switch (props.row.severity) {
        case 'Debug':
            icon = <CircleOutlinedIcon color="action" />;
            break;
        case 'Info':
        case 'Low':
            icon = <InfoOutlinedIcon color="info" />;
            break;
        case 'Warning':
        case 'Moderate':
            icon = <WarningOutlinedIcon color="warning" />;
            break;
        case 'Error':
        case 'Important':
            icon = <ErrorOutlinedIcon color="error" />;
            break;
    }

    if (!icon)
        icon = <QuestionMarkIcon color="disabled" />;

    return (
        <Tooltip title={props.row.severity}>
            {icon}
        </Tooltip>
    );
}
