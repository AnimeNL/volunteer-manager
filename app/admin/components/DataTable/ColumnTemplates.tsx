// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useContext } from 'react';

import type { GridColDef } from '@mui/x-data-grid-premium';
import { default as MuiLink } from '@mui/material/Link';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import type { LogSeverity, MutationSeverity } from '@lib/database/Types';
import { AdminClientContext } from '@app/admin/AdminClientContext';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { resolveTemplatedUrl } from './Utilities';

/**
 * Factory functions to generate a column definition based on a given template.
 */
export const kColumnTemplates = {
    // ---------------------------------------------------------------------------------------------

    account: column => ({
        display: 'flex',

        renderCell: params => {
            const { canAccessAccounts } = useContext(AdminClientContext);

            if (!params.value) {
                return (
                    <Typography component="span" variant="body2"
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        {column.templateProps?.noAccountLabel as string ?? 'Unknown'}
                    </Typography>
                );
            }

            if (!canAccessAccounts)
                return params.value.name;

            return (
                <MuiLink component={Link}
                         href={`/admin/organisation/accounts/${params.value.id}`}>
                    {params.value.name}
                </MuiLink>
            );
        },

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

    component: column => ({
        display: 'flex',

        renderHeader: () => {
            if (!column.templateProps?.headerComponent)
                return undefined;

            const HeaderComponent =
                column.templateProps.headerComponent as React.JSXElementConstructor<any>;
            return <HeaderComponent />;
        },

        renderCell: params => {
            if (!column.templateProps?.component)
                return undefined;

            const Component = column.templateProps.component as
                React.JSXElementConstructor<{ context?: any; row: any }>;
            return <Component context={column.templateProps?.componentContext} row={params.row} />;
        },

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

    linkedText: column => ({
        renderCell: params => {
            let href: string = '#';
            if (column.templateProps?.href)
                href = resolveTemplatedUrl(params.row, column.templateProps.href as string);

            return (
                <MuiLink component={Link} href={href}>
                    {params.value}
                </MuiLink>
            );
        },

        ...column,
    }),

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

    otherFieldText: column => ({
        renderCell: params => params.row[column.templateProps?.field as string],
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

} as const satisfies { [k: string]: (column: GridColDef & { templateProps?: any }) => GridColDef };

/**
 * List of column templates that are predefined and available for generic use.
 */
export type ColumnTemplate = keyof typeof kColumnTemplates;
