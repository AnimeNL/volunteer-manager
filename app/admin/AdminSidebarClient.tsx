// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Badge, { type BadgeProps } from '@mui/material/Badge';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { deepmerge } from '@mui/utils';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { PermissionAccessCheck } from '@lib/auth/AuthenticationContext';
import { AdminSidebarMobileClient } from './AdminSidebarMobileClient';

/**
 * Custom styles applied to the <AdminSidebar> & related components.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    active: {
        '&.Mui-selected': {
            color: 'secondary.dark',
        },
        '&.Mui-selected .MuiSvgIcon-root': {
            color: 'secondary.dark',
        },
    },

    header: {
        backgroundColor: 'animecon.adminHeaderBackground',
        color: 'primary.contrastText',
        paddingX: 2,
        paddingY: 1,
    },
};

/**
 * Properties available to all sidebar entires, regardless of type.
 */
interface AdminSidebarMenuCommon {
    /**
     * Optional condition that, when given, must be `true` in order for the menu option to show.
     */
    condition?: boolean;

    /**
     * The permission this entry is gated behind. Visibility control, not an access control. When
     * multiple permissions are provided, then this entry will be visible when any of them are set.
     */
    permission?: PermissionAccessCheck | PermissionAccessCheck[];
}

/**
 * Interface defining a manually configured divider that is to be added to the menu.
 */
interface AdminSidebarMenuDivider extends AdminSidebarMenuCommon {
    /**
     * Set this to `true` to indicate that a divider should be added to the menu.
     */
    divider: true;
}

/**
 * Base interface for an entry to the administration sidebar interface that applies to all kinds of
 * entries, which includes rendering properties and permission checking.
 */
interface AdminSidebarMenuItemCommon extends AdminSidebarMenuCommon {
    /**
     * The icon that should be displayed with the menu entry. Optional.
     */
    icon?: React.ReactNode;

    /**
     * The label that should be displayed with the menu entry.
     */
    label: string;
}

/**
 * Interface that defines the additional options for menu entries that act as a button, which means
 * that the user is able to immediately navigate to them.
 */
interface AdminSidebarMenuButtonItem {
    /**
     * Optional badge that should be displayed on the menu item. Must be greater than zero.
     */
    badge?: number;

    /**
     * Severity of the badge that should be displayed, when included. Defaults to "default".
     */
    badgeSeverity?: BadgeProps['color'];

    /**
     * The URL for this list item entry. Must be absolute from the domain root.
     */
    url: string;

    /**
     * Match to apply to the URL (or URL prefix) when deciding on highlight state. A prefix match is
     * executed by default, but for root pages a strict match may be more appropriate.
     */
    urlMatchMode?: 'prefix' | 'strict';

    /**
     * The URL prefix for this list entry, all sub-pages of which will be captured for active tab
     * state. Defaults to the URL.
     */
    urlPrefix?: string;
}

/**
 * Interface that defines the additional options for menu entries that are a parent of a sub-menu.
 * These cannot have a URL (as they are collapsable) and cannot show a badge either.
 */
export interface AdminSidebarMenuSubMenuItem {
    /**
     * Whether the menu should be open by default. Defaults to false.
     */
    defaultOpen?: boolean;

    /**
     * Child menu items that should be shown as part of this entry.
     */
    menu: (AdminSidebarMenuItemCommon & AdminSidebarMenuButtonItem)[];
}

/**
 * Interface that specified menu entries for the <AdminSidebar> component must adhere to.
 */
export type AdminSidebarMenuEntry =
    AdminSidebarMenuDivider |
        (AdminSidebarMenuItemCommon & (AdminSidebarMenuButtonItem | AdminSidebarMenuSubMenuItem));

/**
 * Decides whether a particular menu entry should be highlighted. Considered to be the case when the
 * `pathname` starts with the `entry`'s URL (or URL prefix).
 */
function shouldHighlightEntry(pathname: string, entry: AdminSidebarMenuButtonItem) {
    const matchMode = entry.urlMatchMode ?? 'prefix';
    switch (matchMode) {
        case 'prefix':
            return pathname.startsWith(entry.urlPrefix ?? entry.url);
        case 'strict':
            return pathname === entry.url;
    }
}

/**
 * Props accepted by the <RenderSidebarMenu> component.
 */
export interface RenderSidebarMenuProps {
    /**
     * Whether the menu should be indented to reflect nesting.
     */
    indent?: boolean;

    /**
     * The menu entries that should be displayed as part of this sidebar. Required.
     */
    menu: AdminSidebarMenuEntry[];
}

/**
 * Recursively renders the given menu, including the sub-menus that may be contained therein. While
 * this may enable deep recursive situations, TypeScript definitions should "guard" against that.
 */
export function RenderSidebarClient(props: RenderSidebarMenuProps) {
    const { indent, menu } = props;

    const [ collapsedState, setCollapsedState ] = useState<Set<number>>(new Set);
    const pathname = usePathname();

    function toggleCollapsedState(index: number) {
        setCollapsedState(existing => {
            existing.has(index) ? existing.delete(index)
                                : existing.add(index);

            return new Set([ ...existing ]);
        });
    }

    return (
        <List disablePadding>
            { menu.map((entry, index) => {
                if ('divider' in entry)
                    return <Divider key={index} />;

                if (/* AdminSidebarMenuButtonEntry= */ 'menu' in entry) {
                    const open = collapsedState.has(index) === !entry.defaultOpen;

                    return (
                        <React.Fragment key={index}>
                            <ListItemButton divider={true} sx={ indent ? { pl: 5 } : undefined }
                                            onClick={ () => toggleCollapsedState(index) }>

                                { entry.icon &&
                                    <ListItemIcon sx={{ minWidth: '40px' }}>
                                        {entry.icon}
                                    </ListItemIcon> }

                                <ListItemText primaryTypographyProps={{ noWrap: true }}
                                              primary={entry.label} />

                                { open ? <ExpandLess /> : <ExpandMore /> }

                            </ListItemButton>
                            <Collapse in={open} unmountOnExit>
                                <RenderSidebarClient indent menu={entry.menu} />
                                <Divider />
                            </Collapse>
                        </React.Fragment>
                    );
                }

                return (
                    <ListItemButton key={index}
                                    sx={
                                        indent ? deepmerge(kStyles.active, { pl: 5 })
                                               : kStyles.active
                                    }
                                    component={Link} href={entry.url}
                                    selected={shouldHighlightEntry(pathname, entry)}>

                        { entry.icon &&
                            <ListItemIcon sx={{ minWidth: '40px' }}>
                                {entry.icon}
                            </ListItemIcon> }

                        <ListItemText primaryTypographyProps={{ noWrap: true }}
                                      primary={entry.label} />

                        { (typeof entry.badge === 'number' && entry.badge > 0) &&
                            <Badge badgeContent={entry.badge} sx={{ mx: 2 }}
                                   color={ entry.badgeSeverity ?? 'default' } /> }

                    </ListItemButton>
                );
            }) }
        </List>
    );
}

/**
 * Props accepted by the <AdminSidebarClient> component.
 */
interface AdminSidebarClientProps extends RenderSidebarMenuProps {
    /**
     * Whether the sidebar should be rendered in responsive mode, which will optimise for mobile
     * devices when there is a need for this.
     */
    responsive?: boolean;

    /**
     * Title to display at the top of the sidebar.
     */
    title: string;
}

/**
 * Proxy component that renders the sidebar in either desktop mode, or a mobile mode optimised for
 * small screen devices.
 */
export function AdminSidebarClient(props: AdminSidebarClientProps) {
    const isSmallScreenDevice =
        !!props.responsive &&
        // Intentional rule violation because this is a static, transitionary feature:
        // biome-ignore lint/correctness/useHookAtTopLevel: intentional behaviour
        useMediaQuery(theme => theme.breakpoints.down('md'));

    if (isSmallScreenDevice) {
        return (
            <Paper sx={{
                backgroundColor: 'animecon.adminHeaderBackground',
                color: 'primary.contrastText',
            }}>
                <AdminSidebarMobileClient menu={props.menu} title={props.title}>
                    <RenderSidebarClient menu={props.menu} />
                </AdminSidebarMobileClient>
            </Paper>
        );
    }

    return (
        <Paper sx={{ alignSelf: 'flex-start', flexShrink: 0, width: '280px', overflow: 'hidden' }}>
            <Typography variant="h6" sx={kStyles.header}>
                {props.title}
            </Typography>
            <RenderSidebarClient menu={props.menu} />
        </Paper>
    );
}
