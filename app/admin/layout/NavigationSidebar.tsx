// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import IconButton from '@mui/material/IconButton';
import ScienceIcon from '@mui/icons-material/Science';
import SettingsIcon from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';
import Tooltip, { type TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

import { NavigationSidebarLogo } from './NavigationSidebarLogo';

/**
 * Props accepted by the <NavigationSidebar> component.
 */
interface NavigationSidebarProps {
    // TODO
}

/**
 * The <NavigationSidebar> component is the primary mechanism for users to switch between different
 * sections of the administration area, access their user settings, and, when available,
 * configuration relating to active experiments.
 */
export function NavigationSidebar(props: NavigationSidebarProps) {
    return (
        <Stack>
            <NavigationSidebarLogo />
            <NavigationSidebarSectionStack>
                <IconButton LinkComponent={Link} href="/admin">
                    <NavigationSidebarSectionTooltip title="Dashboard">
                        <DashboardIcon htmlColor="white" />
                    </NavigationSidebarSectionTooltip>
                </IconButton>
                <IconButton LinkComponent={Link} href="/admin/events">
                    <NavigationSidebarSectionTooltip title="Events">
                        <EventIcon htmlColor="#fafafa" />
                    </NavigationSidebarSectionTooltip>
                </IconButton>
                <IconButton LinkComponent={Link} href="/admin/organisation">
                    <NavigationSidebarSectionTooltip title="Organisation">
                        <AccountBalanceIcon htmlColor="#fafafa" />
                    </NavigationSidebarSectionTooltip>
                </IconButton>
                <IconButton sx={{ marginTop: 'auto' }}>
                    <NavigationSidebarSectionTooltip title="Experiments">
                        <ScienceIcon color="error" />
                    </NavigationSidebarSectionTooltip>
                </IconButton>
                <IconButton>
                    <NavigationSidebarSectionTooltip title="Settings">
                        <SettingsIcon color="error" />
                    </NavigationSidebarSectionTooltip>
                </IconButton>
            </NavigationSidebarSectionStack>
        </Stack>
    );
}

/**
 * Component that displays the full-height stack for the administration area section buttons.
 */
const NavigationSidebarSectionStack = styled(Stack)(({ theme }) => ({
    backgroundColor: '#0a0a0a',
    borderRadius: theme.shape.borderRadius,
    flexGrow: 1,
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
}));

/**
 * Tooltip used to illustrate what each of the sections may be used for. Will be displayed on the
 * right-hand side of the button in a dark variant of the primary theme colour.
 */
const NavigationSidebarSectionTooltip = styled(({ className, ...props }: TooltipProps) => (
     <Tooltip describeChild {...props} arrow placement="right" classes={{ popper: className }} />
))(({ theme }) => ({
     [`& .${tooltipClasses.arrow}`]: {
        color: theme.palette.primary.dark,
     },
     [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: theme.palette.primary.dark,
        color: theme.palette.primary.contrastText,
     },
}));
