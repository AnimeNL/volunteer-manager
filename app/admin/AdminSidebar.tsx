// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { AdminSidebarMenuEntry, RenderSidebarMenuProps } from './AdminSidebarClient';
import type { AccessControl } from '@lib/auth/AccessControl';
import { RenderSidebarClient } from './AdminSidebarClient';
import { checkPermission, or } from '@lib/auth/AuthenticationContext';

/**
 * Re-export the types from the client file.
 */
export type { AdminSidebarMenuEntry, AdminSidebarMenuSubMenuItem } from './AdminSidebarClient';

/**
 * Custom styles applied to the <AdminSidebar> & related components.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    header: {
        backgroundColor: 'primary.main',
        color: 'primary.contrastText',
        paddingX: 2,
        paddingY: 1,
    },
};

/**
 * Filters the `menu` options based on permissions defined within the structure. When a permission
 * has not been granted, the menu options will be omitted instead.
 */
function filterMenuOptions(inputMenu: AdminSidebarMenuEntry[], access: AccessControl) {
    const menu: AdminSidebarMenuEntry[] = [];
    for (const entry of inputMenu) {
        if (typeof entry.condition === 'boolean' && !entry.condition)
            continue;  // unmet condition

        if (entry.permission) {
            const permissions =
                Array.isArray(entry.permission) ? or(...entry.permission) : entry.permission;

            if (!checkPermission(access, permissions))
                continue;  // not all permissions have been granted
        }

        if ('menu' in entry)
            entry.menu = filterMenuOptions(entry.menu, access) as any;

        menu.push(entry);
    }

    return menu;
}

/**
 * Props accepted by the <AdminSidebar> component.
 */
interface AdminSidebarProps extends RenderSidebarMenuProps {
    /**
     * Access control applicable for the signed in user.
     */
    access: AccessControl;

    /**
     * Title to display at the top of the sidebar.
     */
    title: string;
}

/**
 * The <AdminSidebar> component displays a navigational menu with the configured menu items passed
 * through its props. Expected to render as a child of the <AdminContent> component.
 */
export function AdminSidebar(props: AdminSidebarProps) {
    const menu = filterMenuOptions(props.menu, props.access);
    return (
        <Paper sx={{ alignSelf: 'flex-start', flexShrink: 0, width: '280px', overflow: 'hidden' }}>
            <Typography variant="h6" sx={kStyles.header}>
                {props.title}
            </Typography>
            <RenderSidebarClient menu={menu} />
        </Paper>
    );
}
