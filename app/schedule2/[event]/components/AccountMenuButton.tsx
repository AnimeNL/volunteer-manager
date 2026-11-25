// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import DarkModeIcon from '@mui/icons-material/DarkMode';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LogoutIcon from '@mui/icons-material/Logout';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import PersonIcon from '@mui/icons-material/Person';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { styled, useColorScheme } from '@mui/material/styles';

import { kHeaderBarHeightPx } from '../Constants';

import { signOutAction } from '@lib/auth/actions';

/**
 * Circular M3 tonal account button matching the exact height of the outer title/search pill dock.
 */
const TonalAccountButton = styled(IconButton)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.m3.secondaryContainer,
        color: palette.m3.onSecondaryContainer,
        flexShrink: 0,
        height: kHeaderBarHeightPx,
        width: kHeaderBarHeightPx,
        '&:hover': {
            backgroundColor: `color-mix(in srgb, ${palette.m3.secondaryContainer} 88%, ${palette.m3.onSecondaryContainer})`,
        },
    };
});

/**
 * Circular M3 tonal account button and dropdown menu providing colour-scheme switching and
 * sign-out for the `app/schedule2/` App Shell.
 */
export function AccountMenuButton() {
    const { mode, setMode } = useColorScheme();
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);

    const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleClose = useCallback(() => setAnchorEl(null), []);

    const handleModeChange = useCallback((_event: unknown, value: string | null) => {
        if (value === 'dark' || value === 'light' || value === 'system')
            setMode(value);
    }, [ setMode ]);

    const handleSignOut = useCallback(async () => {
        setAnchorEl(null);

        const response = await signOutAction();
        if (response.success)
            window.location.href = response.returnUrl ?? '/';
    }, []);

    return (
        <>
            <TonalAccountButton aria-label="Account menu" onClick={handleOpen}>
                <PersonIcon fontSize="small" />
            </TonalAccountButton>

            <Menu anchorEl={anchorEl}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  onClose={handleClose}
                  open={!!anchorEl}>
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
