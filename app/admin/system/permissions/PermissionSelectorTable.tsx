// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { CheckboxElement } from '@components/proxy/react-hook-form-mui';

import type {
    DataGridPremiumProps, GridColDef, GridGroupingColDefOverride } from '@mui/x-data-grid-premium';
import { DataGridPremium } from '@mui/x-data-grid-premium';
import BlockIcon from '@mui/icons-material/Block';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportIcon from '@mui/icons-material/Report';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { AccessResult } from '@lib/auth/AccessControl';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Information stored for a particular permission.
 */
export interface PermissionSelectorStatus {
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
 * Grouping column configuration for the permission tree table.
 */
const kGroupingColumn: GridGroupingColDefOverride<PermissionSelectorStatus> = {
    headerName: 'Permission',
    hideDescendantCount: true,
    width: 250,
};

/**
 * Renders a grant or revoke checkbox cell for the given `row`.
 */
function renderPermissionCheckbox(
    prefix: 'grants' | 'revokes', color: 'success' | 'error', row: PermissionSelectorStatus,
    tableReadOnly?: boolean)
{
    if (!row.id)
        return undefined;

    const name = row.suffix ? `${row.id}${row.suffix}` : row.id;
    const readOnly = tableReadOnly || row.restricted;

    return (
        <CheckboxElement name={`${prefix}[${name}]`} size="small" color={color} sx={{ ml: 1 }}
                         labelProps={{
                             // Workaround for MUI checkboxes not supporting the `readOnly` state.
                             sx: { pointerEvents: readOnly ? 'none' : undefined },
                         }} />
    );
}

/**
 * Props accepted by the <PermissionSelectorTable> component.
 */
interface PermissionSelectorTableProps {
    /**
     * The permissions that should be shown in the table.
     */
    permissions: PermissionSelectorStatus[];

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;
}

/**
 * The <PermissionSelectorTable> component displays a data table listing all of the permissions,
 * and whether the principal has been granted them.
 */
export function PermissionSelectorTable(props: PermissionSelectorTableProps) {
    const [ learnMoreOpen, setLearnMoreOpen ] = useState<boolean>(false);

    const [ learnMoreTitle, setLearnMoreTitle ] = useState<string | undefined>();
    const [ learnMoreText, setLearnMoreText ] = useState<string | undefined>();

    const closeLearnMore = useCallback(() => setLearnMoreOpen(false), [ /* no dependencies */ ]);
    const openLearnMore = useCallback((title: string, text: string) => {
        setLearnMoreOpen(true);
        setLearnMoreTitle(title);
        setLearnMoreText(text);

    }, [ /* no dependencies */ ]);

    const columns = useMemo<GridColDef<PermissionSelectorStatus>[]>(() => [
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
                        <IconButton size="small" onClick={() => openLearnMore(title, text)}>
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

            renderCell: params =>
                renderPermissionCheckbox('grants', 'success', params.row, props.readOnly),
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

            renderCell: params =>
                renderPermissionCheckbox('revokes', 'error', params.row, props.readOnly),
        },
    ], [ openLearnMore, props.readOnly ]);

    const getTreeDataPath: DataGridPremiumProps['getTreeDataPath'] = useCallback((row: any) => {
        return row.id.split('.');

    }, [ /* no dependencies */ ]);

    return (
        <>
            <DataGridPremium columns={columns} rows={props.permissions}
                             treeData getTreeDataPath={getTreeDataPath}
                             groupingColDef={kGroupingColumn}
                             defaultGroupingExpansionDepth={ /* all= */ -1 }
                             initialState={{ density: 'compact' }}
                             autoHeight disableColumnMenu hideFooterSelectedRowCount
                             hideFooter />
            <ResponsiveDialog open={learnMoreOpen} onClose={closeLearnMore}
                              title={`${learnMoreTitle} permission`}>
                <Typography variant="body2">
                    {learnMoreText}
                </Typography>
            </ResponsiveDialog>
        </>
    );
}
