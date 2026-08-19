// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Displays an icon button with a dialog that explains that preference data is shared across teams.
 */
export function SharedDataIconButton() {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), []);
    const handleOpen = useCallback(() => setOpen(true), []);

    return (
        <>
            <IconButton size="small" onClick={handleOpen}>
                <Tooltip title="This is shared data…">
                    <WarningAmberIcon color="warning" fontSize="small" />
                </Tooltip>
            </IconButton>
            <ResponsiveDialog open={open} onClose={handleClose}
                              title="These preferences are shared"
                              description={
                                  <>
                                      Volunteers have only one set of preferences for each event,
                                      even when they participate in multiple teams. Updates made in
                                      this team apply to all other teams automatically.
                                  </>
                              } />
        </>
    );
}
