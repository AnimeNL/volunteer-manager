// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button, { buttonClasses } from '@mui/material/Button';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Divider from '@mui/material/Divider';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { styled } from '@mui/material/styles';
import { useColorScheme  } from '@mui/material/styles';

import { AboutDialog } from './AboutDialog';
import { SettingsDialog, type SettingsDialogProps } from './SettingsDialog';
import { SidebarButton } from './SidebarButton';

/**
 * Props accepted by the <SidebarSettingsButton> component.
 */
interface SidebarSettingsButtonProps {
    /**
     * Whether the button is being presented in a mobile view.
     */
    isMobile?: boolean;

    /**
     * Props to share with the settings dialog.
     */
    settingsDialogProps: SettingsDialogProps;
}

/**
 * The <SidebarSettingsButton> is a component that displays a button that, once activated, will
 * open a menu with quick access settings, and an option to click through to other settings.
 */
export function SidebarSettingsButton(props: SidebarSettingsButtonProps) {
    const isMobile = !!props.isMobile;

    const { mode, setMode } = useColorScheme();

    const [ aboutDialogEverOpen, setAboutDialogEverOpen ] = useState<boolean>(false);
    const [ aboutDialogOpen, setAboutDialogOpen ] = useState<boolean>(false);

    const [ settingsDialogEverOpen, setSettingsDialogEverOpen ] = useState<boolean>(false);
    const [ settingsDialogOpen, setSettingsDialogOpen ] = useState<boolean>(false);

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

    const handleSettingsDialogClose = useCallback(() => setSettingsDialogOpen(false), []);
    const handleSettingsDialogOpen = useCallback(() => {
        setSettingsDialogEverOpen(true);
        setSettingsDialogOpen(true);
        setAnchorElement(null);
    }, [ /* no deps */ ]);

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
                  transformOrigin={ isMobile ? { horizontal: 'center', vertical: -4 } : undefined }
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
                <MenuItem dense onClick={handleAboutDialogOpen}>
                    <ListItemIcon>
                        <InfoOutlinedIcon />
                    </ListItemIcon>
                    <ListItemText primary="About this app…" />
                </MenuItem>
                <MenuItem dense onClick={handleSettingsDialogOpen}>
                    <ListItemIcon>
                        <SettingsSuggestIcon />
                    </ListItemIcon>
                    <ListItemText primary="All settings" />
                </MenuItem>
            </Menu>
            { !!aboutDialogEverOpen &&
                <AboutDialog open={aboutDialogOpen} onClose={handleAboutDialogClose} /> }
            { !!settingsDialogEverOpen &&
                <SettingsDialog open={settingsDialogOpen} onClose={handleSettingsDialogClose}
                                {...props.settingsDialogProps} /> }
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
