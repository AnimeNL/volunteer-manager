// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Individual item to include in a navigation section.
 */
export interface NavigationItem {
    /**
     * URL that should be navigated to when this item has been selected.
     */
    href: string;

    /**
     * Label to display on the displayed item.
     */
    label: string;
}

/**
 * Section containing one or more items to include in a navigation menu.
 */
export interface NavigationSection {
    /**
     * Header describing what connects the items in this section.
     */
    header: string;

    /**
     * Items to be included in this section.
     */
    items: NavigationItem[];
}

/**
 * Either an individual item or a section to include at the top-level of a navigation menu.
 */
export type NavigationTopLevelItem = NavigationItem | NavigationSection;
