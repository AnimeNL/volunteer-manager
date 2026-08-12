// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Props accepted by the <ApplicationRestrictedChip> component.
 */
interface ApplicationRestrictedChipProps {
    /**
     * Name of the person whose account has been restricted.
     */
    name: string;

    /**
     * Reason that their account has been restricted.
     */
    reason: string;
}

/**
 * The <ApplicationRestrictedChip> component displays a small MUI <Chip> component that opens a
 * dialog when clicked upon, to indicate that the account has been restricted, including the reason.
 */
export function ApplicationRestrictedChip(props: ApplicationRestrictedChipProps) {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setOpen(false), [ ]);
    const handleDialogOpen = useCallback(() => setOpen(true), [ ]);

    return (
        <>
            <Tooltip title="This account has been restricted">
                <Chip color="error" label="restricted" size="small" clickable
                      onClick={handleDialogOpen} sx={{ ml: 1, mr: 'auto' }} />
            </Tooltip>
            <ResponsiveDialog open={open} onClose={handleDialogClose}
                              title="Their account has been restricted">
                <Typography variant="body2">
                    {props.name} has been restricted from participating in future events for the
                    following reason; their applications can't be accepted until the restriction is
                    lifted.
                </Typography>
                <Alert severity="warning" variant="outlined">
                    {props.reason}
                </Alert>
            </ResponsiveDialog>
        </>
    );
}
