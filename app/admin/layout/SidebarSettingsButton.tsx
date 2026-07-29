// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button, { buttonClasses } from '@mui/material/Button';
import CircleIcon from '@mui/icons-material/Circle';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Divider from '@mui/material/Divider';
import HideSourceIcon from '@mui/icons-material/HideSource';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import { useColorScheme  } from '@mui/material/styles';

import { AboutDialog } from './AboutDialog';
import { SidebarButton } from './SidebarButton';

import { updateUserColour } from './ThemeActions';

/**
 * Props accepted by the <SidebarSettingsButton> component.
 */
interface SidebarSettingsButtonProps {
    /**
     * Whether the button is being presented in a mobile view.
     */
    isMobile?: boolean;
}

/**
 * The <SidebarSettingsButton> is a component that displays a button that, once activated, will
 * open a menu with quick access settings, and an option to click through to other settings.
 */
export function SidebarSettingsButton(props: SidebarSettingsButtonProps) {
    const isMobile = !!props.isMobile;

    const router = useRouter();

    const { mode, setMode } = useColorScheme();

    const [ aboutDialogEverOpen, setAboutDialogEverOpen ] = useState<boolean>(false);
    const [ aboutDialogOpen, setAboutDialogOpen ] = useState<boolean>(false);

    const [ anchorElement, setAnchorElement ] = useState<HTMLElement | null>(null);

    const handleChangeMode = useCallback((event: unknown, value: string) => {
        switch (value) {
            case 'dark':
            case 'light':
                setMode(value);
                break;

            default:
                setMode(null);
                break;
        }
    }, [ setMode ]);

    const handleMenuClose = useCallback(() => setAnchorElement(null), []);
    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorElement(event.currentTarget);
    }, [ /* no deps */ ]);

    const handleAboutDialogClose = useCallback(() => setAboutDialogOpen(false), []);
    const handleAboutDialogOpen = useCallback(() => {
        setAboutDialogEverOpen(true);
        setAboutDialogOpen(true);
        setAnchorElement(null);
    }, [ /* no deps */ ]);

    const handlePickColour = useCallback(async (colour?: string) => {
        await updateUserColour(colour);
        router.refresh();
    }, [ router ]);

    return (
        <>
            { !!props.isMobile &&
                <>
                    <MobileSettingsDivider />
                    <MobileSettingsButton onClick={handleMenuOpen} startIcon={ <SettingsIcon /> }
                                          color="inherit" size="small">
                        Settings
                    </MobileSettingsButton>
                </> }
            { !props.isMobile &&
                <SidebarButton Icon={SettingsIcon} onClick={handleMenuOpen} title="Settings" /> }
            <Menu anchorEl={anchorElement} open={!!anchorElement} onClose={handleMenuClose}
                  transformOrigin={ isMobile ? { horizontal: 'center', vertical: -6 } : undefined }
                  anchorOrigin={ isMobile ? { horizontal: 'right', vertical: 'bottom' }
                                          : { horizontal: 'right', vertical: 'top' } }>
                <MenuItem dense disableRipple disableTouchRipple>
                    <ToggleButtonGroup exclusive fullWidth size="small" value={mode}
                                       onChange={handleChangeMode}>
                        <ToggleButton value="light">
                            <LightModeIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="system">
                            <SettingsBrightnessIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="dark">
                            <DarkModeIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </MenuItem>
                <Divider />
                <MenuItem dense disableRipple disableTouchRipple>
                    <Stack direction="row" spacing={1} sx={{
                        flexGrow: 1,
                        justifyContent: 'space-between'
                    }}>
                        <Tooltip title="Default colour">
                            <IconButton size="small" onClick={ () => handlePickColour() }>
                                <HideSourceIcon />
                            </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={ () => handlePickColour('#2196f3') }>
                            <CircleIcon htmlColor="#2196f3" />
                        </IconButton>
                        <IconButton size="small" onClick={ () => handlePickColour('#ffc107') }>
                            <CircleIcon htmlColor="#ffc107" />
                        </IconButton>
                        <IconButton size="small" onClick={ () => handlePickColour('#e91e63') }>
                            <CircleIcon htmlColor="#e91e63" />
                        </IconButton>
                    </Stack>
                </MenuItem>
                <Divider />
                <MenuItem dense onClick={handleAboutDialogOpen}>
                    <ListItemIcon>
                        <InfoOutlinedIcon />
                    </ListItemIcon>
                    <ListItemText primary="About this app…" />
                </MenuItem>
                <MenuItem component={Link} href="/admin/settings" dense>
                    <ListItemIcon>
                        <SettingsSuggestIcon />
                    </ListItemIcon>
                    <ListItemText primary="All settings" />
                </MenuItem>
            </Menu>
            { !!aboutDialogEverOpen &&
                <AboutDialog open={aboutDialogOpen} onClose={handleAboutDialogClose} /> }
        </>
    );
}

/**
 * Button through which the user is able to access their settings on a mobile device.
 */
const MobileSettingsButton = styled(Button)(({ theme }) => ({
    justifyContent: 'flex-start',
    margin: theme.spacing(1, 0),

    [`& .${buttonClasses.icon}`]: {
        padding: theme.spacing(0, 0, 0, 0.5),
    },
}));

/**
 * Button through which the user is able to access their settings on a mobile device.
 */
const MobileSettingsDivider = styled(Divider)(({ theme }) => ({
    marginTop: 'auto',
}));
