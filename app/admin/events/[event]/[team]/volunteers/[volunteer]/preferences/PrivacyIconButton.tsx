// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import IconButton from '@mui/material/IconButton';
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import Tooltip from '@mui/material/Tooltip';

import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * The <PrivacyIconButton> displays a dialog to the user explaining that the shown data is sensitive
 * and needs to be handled with care.
 */
export function PrivacyIconButton() {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), [ ]);
    const handleOpen = useCallback(() => setOpen(true), [ ]);

    return (
        <>
            <IconButton size="small" onClick={handleOpen}>
                <Tooltip title="This is sensitive data…">
                    <PrivacyTipOutlinedIcon color="warning" fontSize="small" />
                </Tooltip>
            </IconButton>
            <ResponsiveDialog open={open} onClose={handleClose}
                              title="This data is sensitive!"
                              description={
                                  <>
                                      The data shown in this section is especially sensitive and you
                                      have access by exception. Treat it with care, and expect it to
                                      be anonimised after the event.
                                  </>
                              } />
        </>
    );
}
