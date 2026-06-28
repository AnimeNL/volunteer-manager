// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { usePathname } from 'next/navigation';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

import { NavigationSidebarLogo } from './NavigationSidebarLogo';
import { SidebarButton } from './SidebarButton';
import { SidebarSettingsButton } from './SidebarSettingsButton';
import { SidebarVolunteersButton, type SidebarVolunteersButtonProps } from './SidebarVolunteersButton';

/**
 * Props accepted by slots towards the <NavigationSidebar> component.
 */
export interface NavigationSidebarProps {
    /**
     * Whether the organisation menu item should be enabled.
     */
    enableOrganisation?: boolean;

    /**
     * List of active events in the administration area. Expected to be sorted.
     */
    events: SidebarVolunteersButtonProps['events'];

    /**
     * Callback that will be invoked when one of the navigation entries is clicked.
     */
    onClick?: (href?: string) => void;

    /**
     * Variant of the sidebar to display.
     */
    variant: 'desktop' | 'mobile';
}

/**
 * The <NavigationSidebar> component is the primary mechanism for users to switch between different
 * sections of the administration area, access their user settings, and, when available,
 * configuration relating to active experiments.
 */
export function NavigationSidebar(props: NavigationSidebarProps) {
    const path = usePathname();

    const organisationActive = path.startsWith('/admin/organisation');
    const volunteersActive = path.startsWith('/admin/events/');

    const dashboardActive = !organisationActive && !volunteersActive;

    // ---------------------------------------------------------------------------------------------

    const buttons = [ /* none */ ];
    buttons.push(
        <SidebarButton key="dashboard" Icon={DashboardIcon} active={dashboardActive}
                       href="/admin" title="Dashboard"
                       onClick={ props.onClick ? () => props.onClick!('/admin') : undefined } />
    );

    if (props.enableOrganisation) {
        buttons.push(
            <SidebarButton key="organisation" Icon={AccountBalanceIcon} active={organisationActive}
                           href="/admin/organisation" title="Organisation"
                           onClick={
                                props.onClick ? () => props.onClick!('/admin/organisation')
                                              : undefined } />
        );
    }

    if (props.events.length > 0) {
        buttons.push(
            <SidebarVolunteersButton key="volunteers" active={volunteersActive}
                                     events={props.events} onClick={props.onClick} />
        );
    }

    // ---------------------------------------------------------------------------------------------

    if (props.variant === 'desktop') {
        return (
            <Stack>
                <NavigationSidebarLogo />
                <NavigationSidebarDesktopSectionStack spacing={1} useFlexGap>
                    {buttons}
                    <NavigationSidebarDivider flexItem  />
                    <SidebarSettingsButton />
                </NavigationSidebarDesktopSectionStack>
            </Stack>
        );
    } else {
        return (
            <NavigationSidebarMobileSectionStack
                direction="row" spacing={1}
                divider={ <Divider orientation="vertical" flexItem /> }>
                {buttons}
            </NavigationSidebarMobileSectionStack>
        );
    }
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
const NavigationSidebarDesktopSectionStack = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.sidebar,
    borderRadius: theme.vars?.shape.borderRadius,

    flexGrow: 1,

    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
}));


/**
 * Component that displays the full-width stack for different sections on mobile devices.
 */
const NavigationSidebarMobileSectionStack = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.sidebar,
    borderRadius: theme.vars?.shape.borderRadius,

    justifyContent: 'space-evenly',

    marginBottom: theme.spacing(-1),
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
}));
