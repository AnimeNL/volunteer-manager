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
import { resolveRowModelField, resolveTemplate } from './Utilities';

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

            if (!params.value.id || !canAccessAccounts)
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

    date: column => ({
        headerName: 'Date',

        renderCell: params => {
            const format = column.templateProps?.format ?? 'YYYY-MM-DD';
            const href =
                !!column.templateProps?.href &&
                resolveTemplate(params.row, column.templateProps.href);

            if (!!href) {
                return (
                    <MuiLink component={Link} href={href}>
                        <LocalDateTime dateTime={params.value} format={format} />
                    </MuiLink>
                );
            } else {
                return <LocalDateTime dateTime={params.value} format={format} />;
            }
        },

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

    number: column => ({
        renderCell: params => {
            if (!column.templateProps.limit)
                return params.value;

            const limit = typeof column.templateProps.limit === 'number'
                ? column.templateProps.limit
                : resolveRowModelField(params.row, column.templateProps.limit) ?? '∞';

            return (
                <Typography component="span" variant="body2">
                    {params.value}{' '}
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        / {limit}
                    </Typography>
                </Typography>
            );
        },

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

    text: column => ({
        renderCell: params => {
            let value: string;
            if (!!column.templateProps.template) {
                value = resolveTemplate(params.row, column.templateProps.template);
            } else {
                const field = column.templateProps.field ?? column.field;
                value = resolveRowModelField(params.row, field) ?? params.value;
            }

            if (!value) {
                return (
                    <Typography variant="inherit" color="textDisabled" component="span"
                                sx={{ fontStyle: 'italic' }}>
                        { column.templateProps.defaultValue ?? '···' }
                    </Typography>
                );
            }

            if (!!column.templateProps.href) {
                const href = resolveTemplate(params.row, column.templateProps.href);
                return (
                    <MuiLink component={Link} href={href}>
                        {value}
                    </MuiLink>
                );
            }

            return value;
        },

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

} as const satisfies { [k: string]: (column: GridColDef & { templateProps?: any }) => GridColDef };

/**
 * List of column templates that are predefined and available for generic use.
 */
export type ColumnTemplate = keyof typeof kColumnTemplates;
