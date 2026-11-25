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
import { keyframes, useColorScheme } from '@mui/material/styles';

import { useScheduleTitle } from './ScheduleTitle';

import { kDesktopMaximumWidthPx, kDesktopMenuWidthPx, kEnforceSingleLine } from '../Constants';

import { signOutAction } from '@lib/auth/actions';

/**
 * Subtle vertical crossfade keyframes for AppBar title transitions.
 */
const kTitleExitKeyframes = keyframes`
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-4px);
    }
`;

const kTitleEnterKeyframes = keyframes`
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

/**
 * Styling rules for the <ApplicationBar> component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        display: 'block',
        viewTransitionName: 'schedule2-header',
    },

    title: {
        flexGrow: 1,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
    },

    titleEnter: {
        ...kEnforceSingleLine,
        display: 'block',
        animation: `${kTitleEnterKeyframes} 160ms cubic-bezier(0.2, 0, 0, 1) 100ms both`,
        '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
        },
    },

    titleExit: {
        ...kEnforceSingleLine,
        inset: 0,
        pointerEvents: 'none',
        position: 'absolute',
        animation: `${kTitleExitKeyframes} 150ms ease-out both`,
        '@media (prefers-reduced-motion: reduce)': {
            display: 'none',
        },
    },

    titleStatic: {
        ...kEnforceSingleLine,
        display: 'block',
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
 * Renders the AppBar title with a fast, subtle vertical crossfade whenever the title text changes,
 * while rendering statically on initial mount.
 */
function AnimatedTitle(props: { title: string }) {
    const [ state, setState ] = useState<{ current: string; previous?: string; version: number }>({
        current: props.title,
        version: 0,
    });

    if (props.title !== state.current) {
        setState({
            current: props.title,
            previous: state.current,
            version: state.version + 1,
        });
    }

    const handleExitEnd = useCallback(() => {
        setState(prev => prev.version === state.version ? { ...prev, previous: undefined } : prev);
    }, [ state.version ]);

    return (
        <Typography variant="h6" component="div" sx={kStyles.title}>
            { state.previous !== undefined &&
                <Typography key={`exit-${state.version}`} aria-hidden="true" component="span"
                            onAnimationEnd={handleExitEnd} sx={kStyles.titleExit} variant="inherit">
                    {state.previous}
                </Typography> }
            <Typography key={`enter-${state.version}`} component="span" variant="inherit"
                        sx={state.version > 0 ? kStyles.titleEnter : kStyles.titleStatic}>
                {state.current}
            </Typography>
        </Typography>
    );
}

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
                    <AnimatedTitle title={title} />
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
