// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NavigationTopLevelItem } from './NavigationItem';
import { NavigationMenuClient } from './NavigationMenuClient';

/**
 * Props accepted by the <NavigationMenu> component.
 */
interface NavigationMenuProps {
    /**
     * Entries to include in the navigation client.
     */
    items: NavigationTopLevelItem[];

    /**
     * Title of this navigation menu.
     */
    title: string;
}

/**
 * The <NavigationMenu> component.
 */
export function NavigationMenu(props: NavigationMenuProps) {
    // todo

    return (
        <NavigationMenuClient items={props.items} title={props.title} />
    );
}
