// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { default as MuiAppBar } from '@mui/material/AppBar';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { NavigationSidebar, type NavigationSidebarProps } from './NavigationSidebar';
import { NavigationSidebarLogo } from './NavigationSidebarLogo';
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
        sidebar: Omit<NavigationSidebarProps, 'variant'>;
    };
}

/**
 * Top-of-screen application bar used on mobile views of the volunteer manager. Hides various parts
 * of the user interface in order to optimise for the reduced amount of screen real estate.
 */
export function MobileAppBar(props: MobileAppBarProps) {
    const pathname = usePathname();

    const [ drawerOpen, setDrawerOpen ] = useState<boolean>(false);

    const ignorePathnameChangeRef = useRef<boolean>(false);

    const handleDrawerOpen = useCallback(() => setDrawerOpen(true), [ /* no deps */ ]);
    const handleDrawerClose = useCallback(() => {
        ignorePathnameChangeRef.current = false;
        setDrawerOpen(false);
    }, [ /* no deps */ ]);

    // Handles cilcks on entries that should NOT lead to the menu closing. We want to kepe it open
    // for e.g. switches between the different areas of the administration area.
    const handleEntryClick = useCallback((href?: string) => {
        if (href !== pathname)
            ignorePathnameChangeRef.current = true;

    }, [ pathname ]);

    // Automatically close the menu when the page is being navigated. An alternative approach would
    // be to drill an `onClose` prop through several layers of components, but since the performance
    // overhead of this is negligible we optimise for simplicity.
    useEffect(() => {
        if (!pathname)
            return;

        if (ignorePathnameChangeRef.current)
            ignorePathnameChangeRef.current = false;
        else
            setDrawerOpen(false);

    }, [ pathname ]);

    // TODO: Figure out what to do with the page title

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
                    <NavigationSidebarLogo className="anime-logo" />
                </Toolbar>
            </AppBar>
            <AppDrawer open={drawerOpen} onClose={handleDrawerClose} disableScrollLock>
                <NavigationSidebar onClick={handleEntryClick} variant="mobile"
                                   {...props.slotProps.sidebar} />
                {props.menu}
                <SidebarSettingsButton isMobile />
            </AppDrawer>
        </>
    );
}

/**
 * Variant of the <AppBar> styled based on the theme colour.
 */
const AppBar = styled(MuiAppBar)(({ theme }) => ([
    {
        backgroundImage: 'none',

        '& .anime-logo': {
            marginRight: theme.spacing(-2),
            minHeight: 'inherit',
            padding: theme.spacing(0.5),
        },
    },
    theme.applyStyles('light', {
        backgroundColor: `color-mix(in oklch, ${theme.vars?.palette.primary.dark} 85%, #000)`,
    }),
    theme.applyStyles('dark', {
        backgroundColor: `color-mix(in oklch, ${theme.vars?.palette.primary.dark} 65%, #000)`,
        color: theme.vars?.palette.text.primary,
    }),
]));

/**
 * Variant of the <Drawer> component with minimal styling to meet our requirements.
 */
const AppDrawer = styled(Drawer)(({ theme }) => ({
    [`& .${drawerClasses.paper}`]: {
        padding: theme.spacing(0, 1),
        paddingBottom: `max(env(safe-area-inset-bottom), ${theme.spacing(1)})`,
    },
}));
