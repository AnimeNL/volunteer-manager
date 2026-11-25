// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

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
import { keyframes, styled, useColorScheme } from '@mui/material/styles';

import { useScheduleTitle } from './ScheduleTitle';

import { kDesktopMaximumWidthPx, kDesktopMenuWidthPx } from '../Constants';

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
 * Desktop-aligned AppBar toolbar matching <CardContent> horizontal padding.
 */
const ShellToolbar = styled(Toolbar)(({ theme }) => ({
    margin: 'auto',

    // Align the title and account icon with desktop <CardContent> horizontal padding:
    // left = sidebar (259px) + content padding (16px) + card padding (16px) = menuWidth + 16px;
    // right = container padding (16px) + content padding (16px) + card padding (16px) = 48px.
    [theme.breakpoints.up('md')]: {
        maxWidth: `${kDesktopMaximumWidthPx}px`,
        paddingLeft: `${kDesktopMenuWidthPx + 16}px`,
        paddingRight: theme.spacing(6),
    },
}));

/**
 * Container for the crossfading AppBar title text.
 */
const TitleContainer = styled(Typography)({
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
}) as typeof Typography;

/**
 * Single-line title span supporting static, entering, and exiting transition phases.
 */
const TitleText = styled('span', {
    shouldForwardProp: prop => prop !== 'phase',
})<{ phase: 'static' | 'enter' | 'exit' }>({
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',

    variants: [
        {
            props: { phase: 'enter' },
            style: {
                animation:
                    `${kTitleEnterKeyframes} 160ms cubic-bezier(0.2, 0, 0, 1) 100ms both`,
                '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                },
            },
        },
        {
            props: { phase: 'exit' },
            style: {
                inset: 0,
                pointerEvents: 'none',
                position: 'absolute',
                animation: `${kTitleExitKeyframes} 150ms ease-out both`,
                '@media (prefers-reduced-motion: reduce)': {
                    display: 'none',
                },
            },
        },
    ],
});

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
        <TitleContainer variant="h6" component="div">
            { state.previous !== undefined &&
                <TitleText key={`exit-${state.version}`} aria-hidden="true"
                           onAnimationEnd={handleExitEnd} phase="exit">
                    {state.previous}
                </TitleText> }
            <TitleText key={`enter-${state.version}`}
                       phase={state.version > 0 ? 'enter' : 'static'}>
                {state.current}
            </TitleText>
        </TitleContainer>
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
            <AppBar position="sticky"
                    sx={{ display: 'block', viewTransitionName: 'schedule2-header' }}>
                <ShellToolbar>
                    <AnimatedTitle title={title} />
                    <IconButton aria-label="Account menu" color="inherit" edge="end"
                                onClick={handleMenuOpen} size="large">
                        <AccountCircle />
                    </IconButton>
                </ShellToolbar>
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
