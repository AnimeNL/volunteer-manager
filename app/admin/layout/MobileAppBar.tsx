// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import AppBar from '@mui/material/AppBar';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import MoreIcon from '@mui/icons-material/MoreVert';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { SettingsDialogProps } from './SettingsDialog';
import { NavigationSidebar, type NavigationSidebarProps } from './NavigationSidebar';
import { SidebarSettingsButton } from './SidebarSettingsButton';

/**
 * Props accepted by the <MobileAppBar> component.
 */
interface MobileAppBarProps {
    /**
     * Slot that contains the menu for the current section.
     */
    menu: React.ReactNode;

    /**
     * Props that should be given to specific slots part of the layout.
     */
    slotProps: {
        settings: SettingsDialogProps;
        sidebar: NavigationSidebarProps;
    };
}

/**
 * Top-of-screen application bar used on mobile views of the volunteer manager. Hides various parts
 * of the user interface in order to optimise for the reduced amount of screen real estate.
 */
export function MobileAppBar(props: MobileAppBarProps) {
    const [ drawerOpen, setDrawerOpen ] = useState<boolean>(false);

    const handleDrawerClose = useCallback(() => setDrawerOpen(false), [ /* no deps */ ]);
    const handleDrawerOpen = useCallback(() => setDrawerOpen(true), [ /* no deps */ ]);

    // TODO: Figure out what to do with the page title
    // TODO: Connect the "More" settings button to the menu
    // TODO: Close the <AppBar> upon navigation

    return (
        <>
            <AppBar elevation={3} position="sticky" enableColorOnDark>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={handleDrawerOpen}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, ml: 1 }}>
                        { process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION }
                    </Typography>
                    <IconButton edge="end" color="inherit">
                        <MoreIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <AppDrawer open={drawerOpen} onClose={handleDrawerClose}>
                <NavigationSidebar {...props.slotProps.sidebar} variant="mobile" />
                {props.menu}
                <SidebarSettingsButton isMobile settingsDialogProps={props.slotProps.settings}/>
            </AppDrawer>
        </>
    );
}

/**
 * Variant of the <Drawer> component with minimal styling to meet our requirements.
 */
const AppDrawer = styled(Drawer)(({ theme }) => ({
    [`& .${drawerClasses.paper}`]: {
        padding: theme.spacing(0, 1),
    },
}));
