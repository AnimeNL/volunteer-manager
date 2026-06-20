// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Unique IDs given to navigation menus. Used to persist menu state across navigations and browsing
 * sessions. All menus are expected to be referred to in this list.
 */
export type NavigationMenuId =
    /* /admin/events/[event]  */ 'events' |
    /* /admin/organisation    */ 'organisation' |
    /* /admin                 */ 'dashboard';
