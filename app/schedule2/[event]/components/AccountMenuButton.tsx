// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
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
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';

import { kHeaderBarHeightPx } from '../Constants';

import { signOutAction } from '@lib/auth/actions';

/**
 * Props accepted by the <AccountMenuButton> component.
 */
interface AccountMenuButtonProps {
    /**
     * URL of the signed-in user's avatar image, if set.
     */
    avatarUrl?: string;

    /**
     * Display name of the signed-in user for alt text and initials fallback.
     */
    userName?: string;
}

/**
 * Circular M3 tonal account button and dropdown menu providing colour-scheme switching and
 * sign-out for the schedule App Shell.
 */
export function AccountMenuButton(props: AccountMenuButtonProps) {
    const { avatarUrl, userName } = props;
    const { mode, setMode } = useColorScheme();
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);

    function handleModeChange(_event: unknown, value: string | null) {
        if (value === 'dark' || value === 'light' || value === 'system')
            setMode(value);
    }

    async function handleSignOut() {
        setAnchorEl(null);

        const response = await signOutAction();
        if (response.success)
            window.location.href = response.returnUrl ?? '/';
    }

    const initials = userName ? getInitials(userName) : '';

    return (
        <>
            <IconButton aria-label="Account menu"
                        onClick={event => setAnchorEl(event.currentTarget)}
                        sx={{ flexShrink: 0, p: 0 }}>
                <Avatar alt={userName} src={avatarUrl} sx={{
                    bgcolor: 'secondary.main',
                    color: 'secondary.contrastText',
                    height: kHeaderBarHeightPx,
                    width: kHeaderBarHeightPx,
                }}>
                    { initials ? <Typography variant="subtitle2">{initials}</Typography> : undefined }
                </Avatar>
            </IconButton>

            <Menu anchorEl={anchorEl}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  onClose={() => setAnchorEl(null)}
                  open={!!anchorEl}
                  slotProps={{ list: { dense: true } }}>
                <Box sx={{ px: 2, pt: 0.5 }}>
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
                </Box>
                <Divider sx={{ my: 1 }} />
                <MenuItem dense onClick={handleSignOut}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Sign out" />
                </MenuItem>
            </Menu>
        </>
    );
}

/**
 * Extracts up to two uppercase initials from a user's display name for the avatar fallback.
 */
function getInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed)
        return '';

    const uppercase = [ ...trimmed ].filter(char => char >= 'A' && char <= 'Z');
    return uppercase.length
        ? uppercase.slice(0, 2).join('')
        : trimmed[0].toUpperCase();
}
