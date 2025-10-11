// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useMemo, useState } from 'react';

import type { GridColDef, GridRowParams } from '@mui/x-data-grid-pro';
import { DataGridPro } from '@mui/x-data-grid-pro';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Avatar } from '@components/Avatar';

/**
 * Information stored for a user who has been granted a particular permission.
 */
export interface PermissionUserRecord {
    /**
     * Unique ID that identifies this user.
     */
    id: number;

    /**
     * Full name that the user is identified by.
     */
    name: string;

    /**
     * URL to the avatar that represents this person.
     */
    avatar?: string;

    /**
     * Optional event that this record is scoped to.
     */
    event?: string;

    /**
     * Optional team that this record is scoped to.
     */
    team?: string;
}

/**
 * Information stored for an individual permission, as it will be presented in the table.
 */
export interface PermissionRecord {
    /**
     * Unique identifier of the permission, "event.visible:read" for example. Not visible.
     */
    id: string;

    /**
     * Unique identifier of the permission, "event.visible", without the operation.
     */
    permission: string;

    /**
     * The operation associated with this record, when it's a CRUD-based permission.
     */
    operation?: 'create' | 'read' | 'update' | 'delete';

    /**
     * Human-readable name of the permission.
     */
    name: string;

    /**
     * Description associated with the permission, if any.
     */
    description?: string;

    /**
     * List of users who have been granted this permission.
     */
    users: PermissionUserRecord[];
}

/**
 * The <PermissionDetailPanel> component displays more information about the user(s) to whom a
 * particular permission has been granted.
 */
function PermissionDetailPanel(props: { record: PermissionRecord }) {
    type GroupInfo = {
        id: string;
        event?: string;
        team?: string;
        users: PermissionUserRecord[];
    };

    const groups = useMemo(() => {
        const limited: Map<string, GroupInfo> = new Map;
        const global: GroupInfo = {
            id: 'global',
            users: [ /* nobody */ ],
        };

        for (const user of props.record.users) {
            if (!user.event || !user.team) {
                global.users.push(user);
            } else {
                const id = `${user.event}/${user.team}`;
                if (!limited.has(id)) {
                    limited.set(id, {
                        id,
                        event: user.event,
                        team: user.team,
                        users: [ /* empty */ ]
                    });
                }

                limited.get(id)!.users.push(user);
            }
        }

        const groups = global.users.length ? [ global, ...limited.values() ]
                                           : [ ...limited.values() ];

        groups.sort((lhs, rhs) => {
            if (!lhs.event && !rhs.event) return 0;
            if (!lhs.event && rhs.event) return -1;
            if (!rhs.event && lhs.event) return 1;

            if (lhs.event === rhs.event)
                return lhs.team!.localeCompare(rhs.team!);

            return rhs.event!.localeCompare(lhs.event!);
        });

        return groups;

    }, [ props.record ]);

    if (!groups.length) {
        return (
            <Box sx={{ bgcolor: 'background.paper', px: 2, py: 1 }}>
                <Alert severity="warning">
                    Nobody has been granted this permission.
                </Alert>
            </Box>
        );
    }

    return (
        <Stack direction="column" spacing={1} sx={{ bgcolor: 'background.paper', px: 2, py: 1 }}
               divider={ <Divider flexItem /> }>
            { groups.map(group =>
                <Stack direction="row" alignItems="center" key={group.id} spacing={1}>
                    { (!!group.event && !!group.team) &&
                        <Stack direction="column" sx={{ width: 85 }}>
                            <Typography variant="h6">
                                {group.event}
                            </Typography>
                            <Typography variant="caption" sx={{ mt: -0.5 }}>
                                {group.team}
                            </Typography>
                        </Stack> }
                    { group.users.map(user =>
                        <Tooltip key={user.id} title={user.name}>
                            <MuiLink component={Link}
                                     href={`/admin/organisation/accounts/${user.id}/permissions`}>
                                <Avatar src={user.avatar}>{user.name}</Avatar>
                            </MuiLink>
                        </Tooltip> )}
                </Stack> )}
        </Stack>
    );
}

/**
 * Props accepted by the <PermissionsTable> component.
 */
interface PermissionsTableProps {
    /**
     * Permissions that are to be shown in the table.
     */
    permissions: PermissionRecord[];
}

/**
 * The <PermissionsTable> component displays a MUI X DataTable listing all permissions in the system
 * with information on the people it has been granted to.
 */
export function PermissionsTable(props: PermissionsTableProps) {
    const [ learnMoreOpen, setLearnMoreOpen ] = useState<boolean>(false);

    const [ learnMoreTitle, setLearnMoreTitle ] = useState<string | undefined>();
    const [ learnMoreText, setLearnMoreText ] = useState<string | undefined>();

    const closeLearnMore = useCallback(() => setLearnMoreOpen(false), [ /* no dependencies */ ]);
    const openLearnMore = useCallback((title: string, text: string) => {
        setLearnMoreOpen(true);
        setLearnMoreTitle(title);
        setLearnMoreText(text);

    }, [ /* no dependencies */ ]);

    const columns: GridColDef<PermissionRecord>[] = [
        {
            display: 'flex',
            field: 'permission',
            headerName: 'ID',
            sortable: false,
            width: 300,

            renderCell: params => {
                if (!params.row.operation)
                    return params.value;

                return (
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2">
                            {params.value}
                        </Typography>
                        <Chip label={params.row.operation} size="small" />
                    </Stack>
                );
            }
        },
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
            field: 'name',
            headerName: 'Permission',
            sortable: false,
            flex: 1,
        },
        {
            field: 'users',
            headerName: 'Granted…',
            sortable: false,
            flex: 1,

            renderCell: params => {
                switch (params.row.users.length) {
                    case 0:
                        return 'Never';
                    case 1:
                        return '1 time';
                    default:
                        return `${params.row.users.length} times`;
                }
            }
        }
    ];

    const getDetailPanelHeight = useCallback(() => 'auto', [ /* no dependencies */ ]);
    const getDetailPanelContent = useCallback((row: GridRowParams<PermissionRecord>) => {
        return <PermissionDetailPanel record={row.row} />;
    }, [ /* no deps */ ]);

    return (
        <>
            <DataGridPro columns={columns} rows={props.permissions}
                         getDetailPanelContent={getDetailPanelContent}
                         getDetailPanelHeight={getDetailPanelHeight}
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
