// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { CheckboxElement } from '@components/proxy/react-hook-form-mui';

import type { GridColDef, GridGroupNode, GridGroupingColDefOverride, GridRowId, DataGridProProps }
    from '@mui/x-data-grid-pro';
import { DataGridPro } from '@mui/x-data-grid-pro';

import BlockIcon from '@mui/icons-material/Block';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportIcon from '@mui/icons-material/Report';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { AccessResult } from '@lib/auth/AccessControl';

/**
 * Information stored for a particular permission.
 */
export interface AccountPermissionStatus {
    /**
     * Unique ID of the permission. May contain dots as a path separator.
     */
    id: string;

    /**
     * Name given to the permission, succintly describing what it does.
     */
    name: string;

    /**
     * Description associated with the permission, explaining why it does what it does.
     */
    description?: string;

    /**
     * Whether this permission is restricted for the signed in user.
     */
    restricted?: boolean;

    /**
     * The status of this permission, summarising its state.
     */
    status: {
        account: AccessResult | 'partial' | undefined;
        roles: AccessResult | 'partial' | undefined;
    };

    /**
     * Suffix to assign to the form field, to avoid duplicates caused by nesting.
     */
    suffix?: string;

    /**
     * Whether a warning should be shown indicating that this is a dangerous permission.
     */
    warning?: boolean;
}

/**
 * Props accepted by the <AccountPermissionsTable> component.
 */
interface AccountPermissionsTableProps {
    /**
     * The permissions that should be shown in the table.
     */
    permissions: AccountPermissionStatus[];

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;
}

/**
 * The <AccountPermissionsTable> component displays a data table listing all of the permissions,
 * and whether the account has been granted them.
 */
export function AccountPermissionsTable(props: AccountPermissionsTableProps) {
    const permissionGroupsToExpand = useMemo(() => {
        const permissionGroupsToExpand = new Set<GridRowId>();
        for (const permission of props.permissions) {
            if (!permission.status.account || typeof permission.status.account === 'string')
                continue;  // this permission was not set for their account
            if (!!permission.status.account.expanded)
                continue;  // a parent permission led to this permission being granted

            const path = permission.id.split('.');
            do {
                permissionGroupsToExpand.add(path.join('.'));
                path.pop();

            } while (!!path.length)
        }

        return permissionGroupsToExpand;

    }, [ props.permissions ]);

    const [ learnMoreOpen, setLearnMoreOpen ] = useState<boolean>(false);

    const [ learnMoreTitle, setLearnMoreTitle ] = useState<string | undefined>();
    const [ learnMoreText, setLearnMoreText ] = useState<string | undefined>();

    const closeLearnMore = useCallback(() => setLearnMoreOpen(false), [ /* no dependencies */ ]);
    const openLearnMore = useCallback((title: string, text: string) => {
        setLearnMoreOpen(true);
        setLearnMoreTitle(title);
        setLearnMoreText(text);

    }, [ /* no dependencies */ ]);

    const grouping: GridGroupingColDefOverride<AccountPermissionStatus> = {
        headerName: 'Permission',
        hideDescendantCount: true,
        width: 250,
    };

    const columns: GridColDef<AccountPermissionStatus>[] = [
        {
            display: 'flex',
            field: 'description',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            sortable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Learn more…">
                    <InfoOutlinedIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (!params.row.description) {
                    return (
                        <Tooltip title="No description available">
                            <InfoOutlinedIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                }

                const title = params.row.name;
                const text = params.row.description;

                return (
                    <Tooltip title="Learn more…">
                        <IconButton size="small" onClick={() => openLearnMore(title, text) }>
                            <InfoOutlinedIcon color="info" fontSize="small" />
                        </IconButton>
                    </Tooltip>
                );
            },
        },
        {
            display: 'flex',
            field: 'name',
            headerName: 'Name',
            sortable: false,
            flex: 1,

            renderCell: params => {
                if (!!params.value) {
                    return (
                        <>
                            <Typography variant="body2" sx={{ pr: .5 }}>
                                {params.value}
                            </Typography>
                            { !!params.row.warning &&
                                <Tooltip title="This is a dangerous permission">
                                    <ReportIcon color="error" fontSize="small" />
                                </Tooltip> }
                            { !!params.row.restricted &&
                                <Tooltip title="You are not able to change this permission">
                                    <BlockIcon color="warning" fontSize="small" sx={{ ml: 0.5 }} />
                                </Tooltip> }
                        </>
                    );
                }

                return (
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        …
                    </Typography>
                );
            },
        },
        {
            display: 'flex',
            field: 'status',
            headerName: 'Effective status',
            sortable: false,
            flex: 1,

            renderCell: params => {
                if (!params.row.status)
                    return undefined;  // skip generated rows

                let color: string = 'text.disabled';
                let text: string = 'Not granted';

                if (params.row.status.account === 'partial') {
                    color = 'warning.main';
                    text = 'Partially granted';
                } else if (params.row.status.roles === 'partial') {
                    color = 'warning.main';
                    text = 'Partial limited grant';
                } else if (params.row.status.account !== undefined) {
                    const { result, expanded } = params.row.status.account;
                    const suffix = expanded ? ' (inherited)' : '';

                    if (result === 'granted') {
                        color = 'success.main';
                        text = `Granted${suffix}`;
                    } else {
                        color = 'error.main';
                        text = `Revoked${suffix}`;
                    }
                } else if (params.row.status.roles !== undefined) {
                    const { result, expanded } = params.row.status.roles;
                    const suffix = expanded ? ', inherited' : '';

                    if (result === 'granted') {
                        color = 'success.main';
                        text = `Limited granted (role${suffix})`;
                    } else {
                        color = 'error.main';
                        text = `Limited revoked (role${suffix})`;
                    }
                }

                return (
                    <Typography variant="body2" sx={{ color }}>
                        {text}
                    </Typography>
                );
            },
        },
        {
            display: 'flex',
            field: 'granted',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            sortable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Permission granted?">
                    <ThumbUpOutlinedIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (!params.row.id)
                    return undefined;

                let name = params.row.id;
                if (!!params.row.suffix)
                    name += params.row.suffix;

                const readOnly = props.readOnly || params.row.restricted;
                return (
                    <CheckboxElement name={`grants[${name}]`} size="small"
                                     color="success" sx={{ ml: 1 }}
                                     labelProps={{
                                         // This is a workaround for the fact that checkboxes in
                                         // MUI don't support the `readOnly` state, despite
                                         // advertising in TypeScript definitions that they do.
                                         sx: { pointerEvents: readOnly ? 'none' : undefined }
                                     }} />
                );
            },
        },
        {
            display: 'flex',
            field: 'revoked',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            sortable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Permission revoked?">
                    <ThumbDownOutlinedIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (!params.row.id)
                    return undefined;

                let name = params.row.id;
                if (!!params.row.suffix)
                    name += params.row.suffix;

                const readOnly = props.readOnly || params.row.restricted;
                return (
                    <CheckboxElement name={`revokes[${name}]`} size="small"
                                     color="error" sx={{ ml: 1 }}
                                     labelProps={{
                                         // This is a workaround for the fact that checkboxes in
                                         // MUI don't support the `readOnly` state, despite
                                         // advertising in TypeScript definitions that they do.
                                         sx: { pointerEvents: readOnly ? 'none' : undefined }
                                     }} />
                );
            },
        }
    ];

    const getTreeDataPath: DataGridProProps['getTreeDataPath'] = useCallback((row: any) => {
        return row.id.split('.');

    }, [ /* no dependencies */ ]);

    const isGroupExpandedByDefault = useCallback((node: GridGroupNode) => {
        if (!node.depth)
            return true;  // always expand top-level nodes

        return permissionGroupsToExpand.has(node.id);

    }, [ permissionGroupsToExpand ]);

    return (
        <>
            <DataGridPro columns={columns} rows={props.permissions}
                         treeData getTreeDataPath={getTreeDataPath} groupingColDef={grouping}
                         isGroupExpandedByDefault={isGroupExpandedByDefault}
                         initialState={{ density: 'compact' }}
                         autoHeight disableColumnMenu hideFooterSelectedRowCount
                         hideFooter />
            <Dialog fullWidth open={learnMoreOpen} onClose={closeLearnMore}>
                <DialogTitle>
                    {learnMoreTitle} permission
                </DialogTitle>
                <DialogContent sx={{ pb: 0 }}>
                    <DialogContentText>
                        {learnMoreText}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button autoFocus onClick={closeLearnMore}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
