// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * The <SharedDataIconButton> displays a dialog to the user explaining that this data is shared
 * across the team the volunteer participates in.
 */
export function SharedDataIconButton() {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), [ ]);
    const handleOpen = useCallback(() => setOpen(true), [ ]);

    return (
        <>
            <IconButton size="small" onClick={handleOpen}>
                <Tooltip title="This is shared data…">
                    <WarningAmberIcon color="warning" fontSize="small" />
                </Tooltip>
            </IconButton>
            <ResponsiveDialog open={open} onClose={handleClose}
                              title="These preferences are shared!"
                              description={
                                  <>
                                      Volunteers have only one set of preferences for each event,
                                      even if they help out in multiple teams. If you change a
                                      volunteer's preferences in this team, the system updates their
                                      preferences for all other teams automatically.
                                  </>
                              } />
        </>
    );
}
