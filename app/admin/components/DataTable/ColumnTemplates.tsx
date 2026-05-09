// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { GridColDef } from '@mui/x-data-grid-premium';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import Tooltip from '@mui/material/Tooltip';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import { LocalDateTime } from '@app/admin/components/LocalDateTime';

import type { LogSeverity, MutationSeverity } from '@lib/database/Types';

/**
 * Factory functions to generate a column definition based on a given template.
 */
export const kColumnTemplates = {
    // ---------------------------------------------------------------------------------------------

    localDate: column => ({
        headerName: 'Date',
        width: 110,

        renderCell: params =>
            <LocalDateTime dateTime={params.value} format="YYYY-MM-DD" />,

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

    localDateTime: column => ({
        headerName: 'Date',
        width: 175,

        renderCell: params =>
            <LocalDateTime dateTime={params.value} format="YYYY-MM-DD HH:mm:ss" />,

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

    severity: column => ({
        display: 'flex',

        disableColumnMenu: true,
        headerAlign: 'center',
        headerName: '',

        align: 'center',

        width: 50,

        renderHeader: () =>
            <Tooltip title="Severity">
                <InfoOutlinedIcon color="primary" />
            </Tooltip>,

        renderCell: params => {
            const value: LogSeverity | MutationSeverity = params.value;

            let icon: React.ReactNode;
            switch (value) {
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
                <Tooltip title={value}>
                    {icon}
                </Tooltip>
            );
        },

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

} as const satisfies { [k: string]: (column: GridColDef) => GridColDef };

/**
 * List of column templates that are predefined and available for generic use.
 */
export type ColumnTemplate = keyof typeof kColumnTemplates;
