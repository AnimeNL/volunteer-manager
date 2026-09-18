// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ResponsiveDialog } from './ResponsiveDialog';

/**
 * Button to display in a section's header component to indicate that functionality is limited due
 * to a lack of privileges, with clear next steps on how to resolve that.
 */
export function SectionLimitedButton() {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), [ ]);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ ]);

    return (
        <>
            <Tooltip title="Limited functionality…">
                <IconButton onClick={handleDialogOpen}>
                    <GppMaybeOutlinedIcon color="warning" />
                </IconButton>
            </Tooltip>
            <ResponsiveDialog open={dialogOpen} onClose={handleDialogClose}
                              title="Some features are unavailable">
                <Typography variant="body2" color="textSecondary">
                    Certain features on this page are restricted based on your role and permissions.
                    If you require additional access, please talk to your Staff member who can help
                    you get the necessary permissions.
                </Typography>
            </ResponsiveDialog>
        </>
    );
}
