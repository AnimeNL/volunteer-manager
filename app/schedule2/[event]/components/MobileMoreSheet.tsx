// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';

import type { NavigationData } from '../lib/navigationTypes';
import { SecondaryNavigationItems } from './NavigationList';

import { kShellSpacingPx } from '../Constants';

/**
 * Props accepted by the <MobileMoreSheet> component.
 */
interface MobileMoreSheetProps {
    /**
     * Streamed volunteer navigation data, when authenticated.
     */
    data?: NavigationData;

    /**
     * Called when the bottom sheet should close.
     */
    onClose: () => void;

    /**
     * Whether the bottom sheet is currently open.
     */
    open: boolean;

    /**
     * Current pathname relative to `/schedule2/[event]`.
     */
    relativePathname: string;
}

/**
 * Bottom drawer surfaced from the "More" tab in the mobile floating pill bar, hosting secondary
 * schedule routes synced with the desktop sidebar.
 */
export function MobileMoreSheet(props: MobileMoreSheetProps) {
    const { data, onClose, open, relativePathname } = props;
    if (!data)
        return null;

    return (
        <Drawer anchor="bottom" onClose={onClose} open={open}>
            <Box sx={{
                padding: `${kShellSpacingPx}px`,
                paddingBottom: `calc(${kShellSpacingPx}px + env(safe-area-inset-bottom, 0px))`,
            }}>
                <Box sx={{
                    bgcolor: 'divider',
                    borderRadius: 9999,
                    height: 4,
                    marginX: 'auto',
                    mb: 1.5,
                    width: 36,
                }} />

                <List disablePadding>
                    <SecondaryNavigationItems
                        data={data}
                        onNavigate={onClose}
                        relativePathname={relativePathname}
                        sheet />
                </List>
            </Box>
        </Drawer>
    );
}
