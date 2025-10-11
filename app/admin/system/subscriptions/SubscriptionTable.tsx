// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type { GridCellParams, GridGroupingColDefOverride } from '@mui/x-data-grid-pro';
import { default as MuiLink } from '@mui/material/Link';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import type { SubscriptionsRowModel } from '@app/api/admin/subscriptions/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { type SubscriptionType, kSubscriptionType } from '@lib/database/Types';

/**
 * Human-readable descriptions of each of the subscriptions that can be created. Will be presented
 * in the data table.
 */
const kSubscriptionDescriptions: { [k in SubscriptionType]: string } = {
    [kSubscriptionType.Application]: 'When a volunteer applies to help out in this team',
    [kSubscriptionType.Help]: 'When help is requested through a display',
    [kSubscriptionType.Registration]: 'When a volunteer has created an account',
    [kSubscriptionType.Test]: 'Internal test messages',
};

/**
 * Returns whether the row indicated by the given `params` represents a user, as opposed to a
 * subscription that could be created for said user.
 */
function isUserRow(params: GridCellParams<SubscriptionsRowModel, unknown>) {
    return !params.row.path.includes('/');
}

/**
 * The <SubscriptionTable> component displays a MUI Data Grid that lists all individuals who are
 * eligible to be subscribed to notifications, together with the notifications and channels that
 * they are subscribed to.
 */
export function SubscriptionTable() {
    const treeDataColumn: GridGroupingColDefOverride<SubscriptionsRowModel> = {
        headerName: 'Volunteer',
        sortable: false,
        flex: 1,

        hideDescendantCount: true,
        valueFormatter: (value, row) => {
            if (!!row.path.includes('/'))
                return row.name;

            return (
                <MuiLink component={Link} href={`/admin/organisation/accounts/${row.id}`}>
                    {row.name}
                </MuiLink>
            );
        },
    };

    const columns: RemoteDataTableColumn<SubscriptionsRowModel>[] = [
        {
            display: 'flex',
            field: 'subscriptionCount',
            headerName: 'Description',
            editable: false,
            sortable: false,
            flex: 2,

            renderCell: params => {
                if (!!params.row.type)
                    return kSubscriptionDescriptions[params.row.type];

                if (!!params.row.subscriptionCount) {
                    return params.row.subscriptionCount === 1
                        ? '1 active subscription'
                        : `${params.row.subscriptionCount} active subscriptions`;
                }

                return (
                    <Typography variant="body2" color="text.disabled">
                        No subscriptions
                    </Typography>
                );
            },
        },
        {
            field: 'channelEmail',
            headerName: /* empty= */ '',
            headerAlign: 'center',
            align: 'center',
            editable: true,
            sortable: false,
            width: 50,

            type: 'boolean',

            renderHeader: () =>
                <Tooltip title="Distribute using e-mail">
                    <MailOutlineIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (isUserRow(params)) {
                    return /* empty column= */ '';
                } else if (!!params.value) {
                    return <CheckCircleIcon fontSize="small" color="success" />;
                } else {
                    return <CancelIcon fontSize="small" color="error" />;
                }
            },
        },
        {
            field: 'channelSms',
            headerName: /* empty= */ '',
            headerAlign: 'center',
            align: 'center',
            editable: true,
            sortable: false,
            width: 50,

            type: 'boolean',

            renderHeader: () =>
                <Tooltip title="Distribute using SMS">
                    <TextsmsOutlinedIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (isUserRow(params)) {
                    return /* empty column= */ '';
                } else if (!!params.value) {
                    return <CheckCircleIcon fontSize="small" color="success" />;
                } else {
                    return <CancelIcon fontSize="small" color="error" />;
                }
            },
        },
        {
            field: 'channelWhatsapp',
            headerName: /* empty= */ '',
            headerAlign: 'center',
            align: 'center',
            editable: true,
            sortable: false,
            width: 50,

            type: 'boolean',

            renderHeader: () =>
                <Tooltip title="Distribute using WhatsApp">
                    <WhatsAppIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (isUserRow(params)) {
                    return /* empty column= */ '';
                } else if (!!params.value) {
                    return <CheckCircleIcon fontSize="small" color="success" />;
                } else {
                    return <CancelIcon fontSize="small" color="error" />;
                }
            },
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/subscriptions"
                         treeData treeDataColumn={treeDataColumn}
                         defaultSort={{ field: 'name', sort: 'asc' }} pageSize={100}
                         disableFooter enableUpdate isCellEditable={ v => !isUserRow(v) } />
    );
}
