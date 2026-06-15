// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from '@lib/auth/AccessControl';
import type { NavigationItem, NavigationTopLevelItem } from './NavigationItem';
import { NavigationMenuClient } from './NavigationMenuClient';
import { fetchMenuStateFromDatabase, updateMenuState } from './NavigationMenuState';

import { checkPermission, or } from '@lib/auth/AuthenticationContext';

/**
 * Unique IDs given to navigation menus. Used to persist menu state across navigations and browsing
 * sessions. All menus are expected to be referred to in this list.
 */
export type NavigationMenuId =
    /* /admin/events/[event]  */ 'events' |
    /* /admin/organisation    */ 'organisation' |
    /* /admin                 */ 'dashboard';

/**
 * Props accepted by the <NavigationMenu> component.
 */
interface NavigationMenuProps {
    /**
     * Interface through which the signed in user's access will be confirmed.
     */
    access: AccessControl;

    /**
     * Unique ID of this navigation menu.
     */
    id: NavigationMenuId;

    /**
     * Entries to include in the navigation client.
     */
    items: NavigationTopLevelItem[];

    /**
     * Title of this navigation menu.
     */
    title: string;

    /**
     * Unique ID of the signed in user.
     */
    userId: number;
}

/**
 * Helper function to determine whether an individual navigation item should be kept.
 */
function shouldKeepNavigationItem(item: NavigationItem, access: AccessControl): boolean {
    if (item.condition !== undefined && !item.condition)
        return false;

    if (item.permission) {
        const permissions = Array.isArray(item.permission)
            ? or(...item.permission)
            : item.permission;

        if (!checkPermission(access, permissions))
            return false;
    }

    return true;
}

/**
 * The <NavigationMenu> component is the server-side component of the menu, which filters the given
 * items removing ones to which the signed in user does not have access.
 */
export async function NavigationMenu(props: NavigationMenuProps) {
    const filteredItems: NavigationTopLevelItem[] = [];

    for (const item of props.items) {
        if ('items' in item) {
            const sectionItems = item.items.filter(subItem =>
                shouldKeepNavigationItem(subItem, props.access));

            if (sectionItems.length > 0) {
                filteredItems.push({
                    ...item,
                    items: sectionItems,
                });
            }
        } else {
            if (shouldKeepNavigationItem(item, props.access))
                filteredItems.push(item);
        }
    }

    return <NavigationMenuClient items={filteredItems} title={props.title}
                                 state={ await fetchMenuStateFromDatabase(props.userId, props.id) }
                                 updateStateFn={
                                     updateMenuState.bind(null, props.userId, props.id) } />;
}
