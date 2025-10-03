// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Button, { type ButtonProps } from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import LockIcon from '@mui/icons-material/Lock';
import MenuIcon from '@mui/icons-material/Menu';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WifiFindIcon from '@mui/icons-material/WifiFind';

import { DisplayContext, type DisplayContextInfo } from './DisplayContext';
import { formatDate } from '@lib/Temporal';
import {
    getBrightnessValue, setBrightnessValue, getCurrentZonedDateTime, isLockedValue,
    hasRecentlyUpdated, getVolumeValue, setVolumeValue } from './Globals';

import audio from './lib/Audio';
import device from './lib/Device';

/**
 * Component that displays the current time, following the device's local timezone. It will update
 * every minute automatically, although the internal state is updated more frequently.
 */
function CurrentTime(props: { timezone?: string }) {
    const [ date, setDate ] = useState(getCurrentZonedDateTime(props.timezone));

    useEffect(() => {
        const timer = setInterval(() => {
            setDate(getCurrentZonedDateTime(props.timezone));
        }, /* 3 seconds= */ 3000);

        return () => clearInterval(timer);
    });

    return (
        <span suppressHydrationWarning>
            { formatDate(date, 'HH:mm') }
        </span>
    );
}

/**
 * The <DisplayHeaderMenuBrightness> component displays a brightness control, through which the
 * intensity of the display's screen can be controlled.
 */
function DisplayHeaderMenuBrightness() {
    const [ value, setValue ] = useState<number>(getBrightnessValue());

    const handleChange = useCallback((event: unknown, value: number | number[]) => {
        if (typeof value !== 'number')
            return;  // make TypeScript happy

        setBrightnessValue(value);
        setValue(value);

    }, [ /* no dependencies */ ]);

    const handleChangeCommitted = useCallback((event: unknown, value: number | number[]) => {
        if (typeof value !== 'number')
            return;  // make TypeScript happy

        device.setBrightness(value);

    }, [ /* no dependencies */ ]);

    return (
        <Box sx={{ pt: 2 }}>
            <Typography variant="body1" gutterBottom>
                Screen brightness
            </Typography>
            <Slider value={value} min={10} max={250} step={10} shiftStep={10} color="secondary"
                    onChangeCommitted={handleChangeCommitted} onChange={handleChange} />
        </Box>
    );
}

/**
 * The <DisplayHeaderMenuVolume> component displays a volume control, through which the volume of
 * the device's speakers can be controlled.
 */
function DisplayHeaderMenuVolume(props: { confirmVolumeChanges?: boolean }) {
    const [ value, setValue ] = useState<number>(getVolumeValue());

    const handleChange = useCallback((event: unknown, value: number | number[]) => {
        if (typeof value !== 'number')
            return;  // make TypeScript happy

        setVolumeValue(value);
        setValue(value);

    }, [ /* no dependencies */ ]);

    const handleChangeCommitted = useCallback((event: unknown, value: number | number[]) => {
        if (typeof value !== 'number')
            return;  // make TypeScript happy

        device.setVolume(value).then(() => {
            if (!!props.confirmVolumeChanges)
                audio.play('ping');
        });

    }, [ props.confirmVolumeChanges ]);

    return (
        <Box>
            <Typography variant="body1" gutterBottom>
                Volume
            </Typography>
            <Slider value={value} min={10} max={250} step={15} shiftStep={10} color="secondary"
                    onChangeCommitted={handleChangeCommitted} onChange={handleChange} />
        </Box>
    );
}

/**
 * The <DisplayHeaderMenuIpAddresses> component displays a button that, when pressed, presents a
 * popover listing the IP addresses that have been assigned to the display.
 */
function DisplayHeaderMenuIpAddresses() {
    const [ anchorEl, setAnchorEl ] = useState<HTMLButtonElement | undefined>();
    const [ ipAddresses, setIpAddresses ] = useState<string[]>([ /* empty state */ ]);

    const handleClose = useCallback(() => {
        setAnchorEl(undefined);
        setTimeout(() => setIpAddresses([ ]), 300);
    }, [ /* no dependencies */ ]);

    const handleOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
        device.getIpAddresses().then(ipAddresses => {
            if (!!ipAddresses)
                setIpAddresses(ipAddresses.sort());
        });
    }, [ /* no dependencies */ ]);

    return (
        <>
            <IconButton onClick={handleOpen}>
                <WifiFindIcon />
            </IconButton>
            <Popover anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}
                     anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                     transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                     slotProps={{ paper: { sx: { backgroundColor: '#15191c' } } }}>
                <Box sx={{ p: 2, pb: 1 }}>
                    { !ipAddresses.length && <CircularProgress color="inherit" size={24} /> }
                    { !!ipAddresses.length &&
                        <List dense disablePadding>
                            {ipAddresses.map(ipAddress =>
                                <ListItem key={ipAddress}>
                                    <ListItemText primary={ipAddress} />
                                </ListItem> )}
                        </List> }
                </Box>
            </Popover>
        </>
    );
}

/**
 * The <DisplayHeaderMenuLockedIcon> displays a lock icon when the device is locked, or nothing when
 * it's not. Clicking on the icon reveals an alert dialog with a lie.
 */
function DisplayHeaderMenuLockedIcon() {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleOpen = useCallback(() => setOpen(true), [ /* no dependencies */ ]);
    const handleClose = useCallback(() => setOpen(false), [ /* no dependencies */ ]);

    return (
        <>
            <IconButton onClick={handleOpen}>
                <LockIcon />
            </IconButton>
            <Dialog open={open} onClose={handleClose} fullWidth>
                <DialogTitle>
                    Unlock this device
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        This device has been locked by volunteering leads. If absolutely needed, it
                        can be unlocked by loudly saying the following phrase near the device:
                    </Typography>
                    <Typography sx={{ borderLeft: '4px solid #666', pl: 2, mt: 2, mb: 1 }}>
                        そうならいいね
                    </Typography>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * The <DisplayHeaderMenuWarning> component displays a warning that's to be displayed in the menu,
 * to inform the reader that something is very wrong.
 */
function DisplayHeaderMenuWarning(props: React.PropsWithChildren) {
    return (
        <Alert severity="error" sx={{ backgroundColor: '#4e0000', color: '#ffffff' }}>
            {props.children}
        </Alert>
    );
}

/**
 * Component that will display the drawer menu for the display. Some basic display configuration
 * should be available here (such as brightness), as well as environmental and device information.
 */
function DisplayHeaderMenu(props: { display: DisplayContextInfo }) {
    const { display } = props;

    const context = display.context;
    const router = useRouter();

    const [ refreshColor, setRefreshColor ] = useState<ButtonProps['color']>('secondary');
    const [ refreshLoading, setRefreshLoading ] = useState<boolean>(false);

    const handleRefresh = useCallback(async () => {
        setRefreshLoading(true);
        try {
            if (!!display.refresh)
                await display.refresh();

            setRefreshColor('success');

        } catch (error: any) {
            console.warn('Exception when refreshing the header:', error);
            setRefreshColor('error');

        } finally {
            setTimeout(() => setRefreshColor('secondary'), 3000);
            setRefreshLoading(false);
        }
    }, [ display ]);

    const [ devEnvironmentDisabled, setDevEnvironmentDisabled ] = useState<boolean>(false);
    useEffect(() => {
        setDevEnvironmentDisabled(false);
        if (!!context && !!context.config.devEnvironment) {
            try {
                const currentUrl = new URL(window.location.href);
                const devUrl = new URL(context.config.devEnvironment);

                if (currentUrl.host === devUrl.host) {
                    setDevEnvironmentDisabled(true);
                    return;
                }
            } catch (error: any) {
                console.warn(error);
                console.error(`Invalid devEnvironment setting: ${context.config.devEnvironment}`);
            }
        }
    }, [ context ]);

    const navigateToDevEnvironment = useCallback(() => {
        if (!!context?.config.devEnvironment)
            router.push(context.config.devEnvironment);

    }, [ context?.config.devEnvironment, router ]);

    return (
        <Stack direction="column" justifyContent="space-between" sx={{ height: '100%' }}>
            <Stack direction="column" spacing={2}>
                { !context &&
                    <DisplayHeaderMenuWarning>
                        The display is not able to reach the provisioning server. Please ask a
                        volunteering lead for assistance.
                    </DisplayHeaderMenuWarning> }
                { (!!context && !context.provisioned) &&
                    <DisplayHeaderMenuWarning>
                        This display has not been provisioned yet. Please ask a volunteering lead
                        for assistance.
                    </DisplayHeaderMenuWarning> }
                { (!!context && !!context.provisioned && !hasRecentlyUpdated()) &&
                    <DisplayHeaderMenuWarning>
                        This display is operational, but has not been able to update in the past
                        five minutes.
                    </DisplayHeaderMenuWarning> }
                { (!!context && !!context.provisioned && hasRecentlyUpdated()) &&
                    <Alert severity="success" sx={{ backgroundColor: '#08440c', color: '#ffffff' }}>
                        This display is fully operational.
                    </Alert> }
                <Button fullWidth variant="outlined" color={refreshColor} loading={refreshLoading}
                        onClick={handleRefresh}
                        sx={{ transition: 'border-color .3s ease-in, color .3s ease-in' }}>
                    Refresh
                </Button>
                <DisplayHeaderMenuBrightness />
                <DisplayHeaderMenuVolume
                    confirmVolumeChanges={context?.config.confirmVolumeChanges} />
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                    { !!context &&
                        <Chip label={context.identifier} size="small" sx={{ pt: 0.25 }} /> }
                </Box>
                <Stack direction="row" divider={ <Divider orientation="vertical" flexItem /> }
                       spacing={2}>
                    <IconButton disabled={devEnvironmentDisabled}
                                onClick={navigateToDevEnvironment}>
                        <DeveloperBoardIcon />
                    </IconButton>
                    { isLockedValue() && <DisplayHeaderMenuLockedIcon /> }
                    <DisplayHeaderMenuIpAddresses />
                </Stack>
            </Stack>
        </Stack>
    );
}

/**
 * The <DisplayHeader> component displays the Display's header bar, which contains the logo, name,
 * current time and an overflow menu granting access to device configuration.
 */
export function DisplayHeader() {
    const display = useContext(DisplayContext);

    const [ menuOpen, setMenuOpen ] = useState<boolean>(false);

    const handleCloseMenu = useCallback(() => setMenuOpen(false), [ /* no dependencies */ ]);
    const handleOpenMenu = useCallback(() => setMenuOpen(true), [ /* no dependencies */ ]);

    return (
        <>
            <Paper elevation={0} sx={{ px: 2, py: 1, background: 'none' }}>
                <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
                    <Box>
                        <Typography variant="h1" sx={{ pb: .5 }}>
                            { display.context?.label ?? 'AnimeCon Display' }
                        </Typography>
                        <Typography variant="subtitle1">
                            AnimeCon Volunteering Teams
                        </Typography>
                    </Box>
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={3}
                            divider={ <Divider orientation="vertical" flexItem /> }>
                            <Typography variant="h2" sx={{ pr: 1.75 }}>
                                <CurrentTime timezone={display.context?.config.timezone} />
                            </Typography>
                            <IconButton size="large" onClick={handleOpenMenu}>
                                <Badge color="warning" variant="dot" invisible={!display.isLoading}>
                                    <MenuIcon color="disabled" />
                                </Badge>
                            </IconButton>
                        </Stack>
                    </Box>
                </Stack>
            </Paper>
            <Drawer anchor="right" onClose={handleCloseMenu} open={menuOpen}
                    PaperProps={{ sx: { width: '350px', p: 4 } }}>
                <DisplayHeaderMenu display={display} />
            </Drawer>
        </>
    );
}
