// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import { styled } from '@mui/material/styles';

import type { NavigationData } from '../lib/navigationTypes';
import { SecondaryNavigationItems } from './NavigationList';

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
     * Current pathname relative to the event schedule root.
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
                p: 1.5,
                pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            }}>
                <SheetHandle />

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

/**
 * Drag handle pill centred at the top of the mobile More bottom sheet.
 */
const SheetHandle = styled('div')(({ theme }) => ({
    backgroundColor: (theme.vars || theme).palette.divider,
    borderRadius: 9999,
    height: 4,
    marginBottom: theme.spacing(1.5),
    marginLeft: 'auto',
    marginRight: 'auto',
    width: 36,
}));
