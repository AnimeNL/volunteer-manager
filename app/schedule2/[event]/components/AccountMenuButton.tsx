// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import CodeIcon from '@mui/icons-material/Code';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Divider from '@mui/material/Divider';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LogoutIcon from '@mui/icons-material/Logout';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';

import { getNavigationTransitionTypes, getRelativeNavigationPath,
    getSchedulePath } from '../lib/navigationTypes';

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
     * Slug of the active event when the signed-in user has schedule access.
     */
    eventSlug?: string;

    /**
     * Whether the signed-in volunteer has access to event settings (`event.settings`).
     */
    hasDevelopment?: boolean;

    /**
     * Whether the signed-in volunteer has a confirmed hotel room booking for this event.
     */
    hasHotelRoom?: boolean;

    /**
     * Whether the signed-in volunteer has an assigned festival ticket for this event.
     */
    hasTicket?: boolean;

    /**
     * Display name of the signed-in user for alt text and initials fallback.
     */
    userName?: string;
}

/**
 * Circular M3 tonal account button and dropdown menu providing colour-scheme switching, event
 * account links, and sign-out for the schedule App Shell.
 */
export function AccountMenuButton(props: AccountMenuButtonProps) {
    const { avatarUrl, eventSlug, hasDevelopment, hasHotelRoom, hasTicket, userName } = props;
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
                  slotProps={{ list: { dense: true }, paper: { sx: { minWidth: 175 } } }}>
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
                { !!eventSlug &&
                    <EventAccountMenuItems
                        eventSlug={eventSlug}
                        hasDevelopment={hasDevelopment}
                        hasHotelRoom={hasHotelRoom}
                        hasTicket={hasTicket}
                        onClose={() => setAnchorEl(null)} /> }
                <MenuItem onClick={handleSignOut}>
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
 * Leaf client component reading `usePathname()` for event-scoped account menu links so the static
 * `<AccountMenuButton />` fallback never suspends during prerendering.
 */
function EventAccountMenuItems(props: {
    eventSlug: string;
    hasDevelopment?: boolean;
    hasHotelRoom?: boolean;
    hasTicket?: boolean;
    onClose: () => void;
}) {
    const { eventSlug, hasDevelopment, hasHotelRoom, hasTicket, onClose } = props;
    const pathname = usePathname();
    const relativePathname = getRelativeNavigationPath(pathname, eventSlug);

    const personalItems = [
        hasHotelRoom && {
            icon: <HotelOutlinedIcon fontSize="small" />,
            label: 'Hotel room',
            segment: '/hotel',
        },
        hasTicket && {
            icon: <QrCode2Icon fontSize="small" />,
            label: 'Your ticket',
            segment: '/ticket',
        },
    ].filter((item): item is Exclude<typeof item, false | undefined> => !!item);

    const portalItems = [
        hasDevelopment && {
            icon: <CodeIcon fontSize="small" />,
            label: 'Development',
            segment: '/settings',
        },
        {
            icon: <FeedbackOutlinedIcon fontSize="small" />,
            label: 'Feedback',
            segment: '/feedback',
        },
    ].filter((item): item is Exclude<typeof item, false | undefined> => !!item);

    function renderMenuItem(item: { icon: React.ReactNode; label: string; segment: string }) {
        return (
            <MenuItem
                key={item.segment}
                component={Link}
                href={getSchedulePath(eventSlug, item.segment)}
                onClick={onClose}
                transitionTypes={getNavigationTransitionTypes(relativePathname, item.segment)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
            </MenuItem>
        );
    }

    return (
        <>
            { personalItems.length > 0 && (
                <>
                    { personalItems.map(renderMenuItem) }
                    <Divider sx={{ my: 1 }} />
                </>
            ) }
            { portalItems.map(renderMenuItem) }
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
