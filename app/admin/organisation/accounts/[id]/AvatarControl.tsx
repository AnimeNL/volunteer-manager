// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneIcon from '@mui/icons-material/Done';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { ConfirmationDialog } from '@app/admin/components/ConfirmationDialog';

/**
 * Props accepted by the <AvatarControl> component.
 */
interface AvatarControlProps {
    /**
     * Alternative text, for accessibility purposes.
     */
    alt?: string;

    /**
     * Server action to invoke when the avatar should be deleted.
     */
    deleteFn?: ServerAction;

    /**
     * Whether the selected avatar is the default one for this user.
     */
    isDefault?: boolean;

    /**
     * Server action to invoke when the avatar should be set as the default one.
     */
    setDefaultFn?: ServerAction;

    /**
     * Source of the image that is the visual representation of this avatar.
     */
    src?: string;
}

/**
 * The <AvatarControl> component displays a particular avatar, optionally with the ability to
 * remove the avatar from the system altogether, or to (re)select it as the user's default avatar.
 * Availability of these options is controled through the given server actions.
 */
export function AvatarControl(props: AvatarControlProps) {
    const router = useRouter();

    const [ deleteOpen, setDeleteOpen ] = useState<boolean>(false);

    const [ snackbarOpen, setSnackbarOpen ] = useState<boolean>(false);
    const [ snackbarText, setSnackbarText ] = useState<string | undefined>();
    const [ snackbarType, setSnackbarType ] = useState<'error' | 'info' | 'success'>('info');

    const handleCloseSnackbar = useCallback(() => setSnackbarOpen(false), [ /* no deps */ ]);

    const handleDeleteClose = useCallback(() => setDeleteOpen(false), [ /* no deps */ ]);
    const handleDeleteOpen = useCallback(() => setDeleteOpen(true), [ /* no deps */ ]);

    const { deleteFn, setDefaultFn } = props;

    const handleDeleteCommit = useCallback(async () => {
        if (!deleteFn)
            return { error: 'No delete action is available' };

        const result = await deleteFn(new FormData);
        if (!result.success)
            return { error: result.error };

        setSnackbarOpen(true);
        setSnackbarText('Selected avatar has been deleted');
        setSnackbarType('success');

        router.refresh();
        return true;

    }, [ deleteFn, router ]);

    const handleSetDefault = useCallback(async () => {
        try {
            if (!setDefaultFn)
                throw new Error('No default action is available');

            const result = await setDefaultFn(new FormData);
            if (!result.success)
                throw new Error(result.error ?? 'Unable to update the default avatar');

            setSnackbarText('Selected avatar has been updated');
            setSnackbarType('success');

            router.refresh();

        } catch (error: any) {
            setSnackbarText(error.message);
            setSnackbarType('error');
        } finally {
            setSnackbarOpen(true);
        }
    }, [ setDefaultFn, router ]);

    return (
        <>
            <Badge anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} overlap="circular"
                badgeContent={
                    <Stack direction="row" spacing={1} sx={{
                        backgroundColor: 'primary.main',
                        borderRadius: 2,
                        color: 'white',
                        padding: 0.5,
                    }}>
                        { !!props.setDefaultFn &&
                            <Tooltip title="Set as default">
                                <DoneIcon fontSize="small" onClick={handleSetDefault}
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    fill: theme => theme.palette.success.light,
                                                }
                                            }} />
                            </Tooltip> }
                        { !!props.deleteFn &&
                            <Tooltip title="Delete…">
                                <DeleteIcon fontSize="small" onClick={handleDeleteOpen}
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    fill: theme => theme.palette.error.light,
                                                }
                                            }} />
                            </Tooltip> }
                    </Stack>
                }>
                <Avatar alt={props.alt} src={props.src}
                        sx={{
                            outline: props.isDefault
                                ? theme => `4px solid ${theme.palette.success.light}`
                                : undefined,

                            width: 96,
                            height: 96,
                        }} />
            </Badge>
            <Snackbar open={snackbarOpen} autoHideDuration={2500} onClose={handleCloseSnackbar}>
                <Alert severity={snackbarType} variant="filled">
                    {snackbarText}
                </Alert>
            </Snackbar>
            { !!props.deleteFn &&
                <ConfirmationDialog open={deleteOpen} onClose={handleDeleteClose}
                                    onConfirm={handleDeleteCommit}
                                    title="Delete this avatar?" confirmLabel="Delete">
                    <Typography variant="body1">
                        Are you sure you want to remove this avatar? Once it's gone, you won't be
                        able to bring it back.
                    </Typography>
                </ConfirmationDialog> }
        </>
    );
}
