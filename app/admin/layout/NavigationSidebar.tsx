// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

import { NavigationSidebarLogo } from './NavigationSidebarLogo';
import { SidebarButton } from './SidebarButton';
import { SidebarSettingsButton } from './SidebarSettingsButton';
import { SidebarVolunteersButton } from './SidebarVolunteersButton';

/**
 * Props accepted by the <NavigationSidebar> component.
 */
interface NavigationSidebarProps {
    /**
     * Whether the organisation menu item should be enabled.
     */
    enableOrganisation?: boolean;
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
            <NavigationSidebarSectionStack spacing={1} useFlexGap>
                <SidebarButton Icon={DashboardIcon} active href="/admin" title="Dashboard" />
                { props.enableOrganisation &&
                    <SidebarButton Icon={AccountBalanceIcon} href="/admin/organisation"
                                   title="Organisation" /> }
                <SidebarVolunteersButton />
                <NavigationSidebarDivider flexItem  />
                <SidebarSettingsButton />
            </NavigationSidebarSectionStack>
        </Stack>
    );
}

/**
 * Component representing a divider that splits the sidebar, and renders in a consistent colour.
 */
const NavigationSidebarDivider = styled(Divider)(({ theme }) => ({
    borderColor: theme.palette.grey[800],
    marginTop: 'auto'
}));

/**
 * Component that displays the full-height stack for the administration area section buttons.
 */
const NavigationSidebarSectionStack = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.sidebar,
    borderRadius: theme.vars?.shape.borderRadius,
    flexGrow: 1,
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
}));
