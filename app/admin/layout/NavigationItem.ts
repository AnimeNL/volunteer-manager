// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type SvgIcon from '@mui/material/SvgIcon';

/**
 * Individual item to include in a navigation section.
 */
export interface NavigationItem {
    /**
     * Icon to display in front of the item.
     */
    Icon: typeof SvgIcon;

    /**
     * Badge to display on the right-hand side of the item, if any.
     */
    badge?: {
        /**
         * Severity of the badge. Will be considered in the presentation.
         */
        severity?: 'error' | 'success' | 'warning';

        /**
         * Value of the badge. `true` will be shown as a dot, where numeric values other than zero
         * will be shown as a number.
         */
        value: boolean | number;
    };

    /**
     * Label to display as the item's primary text.
     */
    label: string;

    /**
     * URL that should be navigated to when this item has been selected.
     */
    url: string;

    /**
     * Match to apply to the URL (or URL prefix) when deciding on highlight state.
     * @default "prefix"
     */
    urlMatchMode?: 'prefix' | 'strict';

    /**
     * URL prefix that should be used when deciding on highlight state, instead of the `url`.
     */
    urlPrefix?: string;
}

/**
 * Section containing one or more items to include in a navigation menu.
 */
export interface NavigationSection {
    /**
     * Colour in which the section's title will be displayed.
     */
    color?: string;

    /**
     * Whether the section should be expanded by default.
     */
    defaultExpanded?: boolean;

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
