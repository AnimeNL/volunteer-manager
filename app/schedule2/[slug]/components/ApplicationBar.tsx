// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AppBar from '@mui/material/AppBar';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LogoutIcon from '@mui/icons-material/Logout';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';

import { useScheduleTitle } from './ScheduleTitle';

import { kDesktopMaximumWidthPx, kDesktopMenuWidthPx, kEnforceSingleLine } from '../Constants';

import { signOutAction } from '@lib/auth/actions';

/**
 * Styling rules for the <ApplicationBar> component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        display: 'block',
        viewTransitionName: 'schedule2-header',
    },

    title: {
        ...kEnforceSingleLine,
        flexGrow: 1,
    },

    toolbar: {
        margin: 'auto',

        // Align the title and account icon with desktop <CardContent> horizontal padding:
        // left = sidebar (259px) + content padding (16px) + card padding (16px) = menuWidth + 16px;
        // right = container padding (16px) + content padding (16px) + card padding (16px) = 48px.
        paddingLeft: {
            md: `${kDesktopMenuWidthPx + 16}px`,
        },
        paddingRight: {
            md: 6,
        },

        maxWidth: {
            md: `${kDesktopMaximumWidthPx}px`,
        },
    },
};

/**
 * Sticky top bar of the schedule2 App Shell, anchored across view transitions. Provides the active
 * page title from <ScheduleTitleProvider> and an account menu with the colour-scheme toggle.
 */
export function ApplicationBar() {
    const title = useScheduleTitle();
    const { mode, setMode } = useColorScheme();

    const [ userMenuAnchor, setUserMenuAnchor ] = useState<HTMLElement | null>(null);

    const handleMenuClose = useCallback(() => setUserMenuAnchor(null), []);
    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchor(event.currentTarget);
    }, []);

    const handleModeChange = useCallback((_event: unknown, value: string | null) => {
        switch (value) {
            case 'dark':
            case 'light':
            case 'system':
                setMode(value);
                break;

            default:
                break;
        }
    }, [ setMode ]);

    const handleSignOut = useCallback(async () => {
        setUserMenuAnchor(null);

        const response = await signOutAction();
        if (response.success)
            window.location.href = response.returnUrl ?? '/';
    }, []);

    return (
        <>
            <AppBar position="sticky" sx={kStyles.container}>
                <Toolbar sx={kStyles.toolbar}>
                    <Typography variant="h6" component="div" sx={kStyles.title}>
                        {title}
                    </Typography>
                    <IconButton aria-label="Account menu" color="inherit" edge="end"
                                onClick={handleMenuOpen} size="large">
                        <AccountCircle />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Menu anchorEl={userMenuAnchor}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  onClose={handleMenuClose}
                  open={!!userMenuAnchor}>
                <MenuItem dense disableRipple disableTouchRipple>
                    <ToggleButtonGroup exclusive fullWidth onChange={handleModeChange} size="small"
                                       value={mode ?? 'system'}>
                        <ToggleButton aria-label="Light mode" value="light">
                            <LightModeIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton aria-label="System colour scheme" value="system">
                            <SettingsBrightnessIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton aria-label="Dark mode" value="dark">
                            <DarkModeIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleSignOut}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        Sign out
                    </ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
}
