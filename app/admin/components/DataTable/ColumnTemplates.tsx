// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type { GridColDef } from '@mui/x-data-grid-premium';
import { default as MuiLink } from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import { InlineAccountLink } from '../InlineAccountLink';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { SeverityCell, SeverityHeader } from './cells/SeverityCell';
import { resolveRowModelField, resolveTemplate } from './Utilities';

/**
 * Factory functions to generate a column definition based on a given template.
 */
export const kColumnTemplates = {
    // ---------------------------------------------------------------------------------------------

    account: column => ({
        display: 'flex',

        renderCell: params => {
            if (!params.value) {
                return (
                    <Typography component="span" variant="body2" noWrap
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        {column.templateProps?.noAccountLabel as string ?? 'Unknown'}
                    </Typography>
                );
            }

            return (
                <Typography variant="inherit" noWrap>
                    <InlineAccountLink user={params.value} />
                </Typography>
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

            const HeaderComponent = column.templateProps.headerComponent as
                React.JSXElementConstructor<{ context?: any; }>;

            return <HeaderComponent context={column.templateProps.componentContext} />;
        },

        renderCell: params => {
            if (!column.templateProps?.component)
                return undefined;

            const Component = column.templateProps.component as
                React.JSXElementConstructor<{ context?: any; row: any }>;
            return <Component context={column.templateProps.componentContext} row={params.row} />;
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
                        <LocalDateTime dateTime={params.value} fixedWidth format={format} />
                    </MuiLink>
                );
            } else {
                return <LocalDateTime dateTime={params.value} fixedWidth format={format} />;
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

        renderHeader: () => <SeverityHeader />,
        renderCell: params => <SeverityCell row={{ severity: params.value }} />,

        ...column,
    }),

    // ---------------------------------------------------------------------------------------------

    text: column => ({
        renderCell: params => {
            let value: string;
            if (!!column.templateProps?.template) {
                value = resolveTemplate(params.row, column.templateProps?.template);
            } else {
                const field = column.templateProps?.field ?? column.field;
                value = resolveRowModelField(params.row, field) ?? params.value;
            }

            if (!value && !column.templateProps?.prefix) {
                return (
                    <Typography variant="inherit" color="textDisabled" component="span"
                                sx={{ fontStyle: 'italic' }}>
                        { column.templateProps?.defaultValue ?? '···' }
                    </Typography>
                );
            }

            if (!!column.templateProps?.href) {
                const href = resolveTemplate(params.row, column.templateProps?.href);
                return (
                    <MuiLink component={Link} href={href}>
                        { !!column.templateProps?.prefix &&
                            <Typography variant="inherit" color="textDisabled" component="span">
                                {column.templateProps?.prefix}
                            </Typography> }
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
