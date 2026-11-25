// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Spatial order of top-level schedule2 navigation segments for directional view transitions.
 */
const kNavigationSectionOrder = [
    '', '/shifts', '/areas', '/duty-book', '/help-requests', '/knowledge', '/volunteers',
];

/**
 * Program area summary rendered in schedule2 navigation menus.
 */
export interface NavigationArea {
    activeCount: number;
    id: number;
    name: string;
}

/**
 * Team-scoped Duty Book summary rendered in schedule2 navigation menus.
 */
export interface NavigationDutyBook {
    name: string;
    team: string;
    unread: number;
}

/**
 * Serializable navigation state shared between desktop and mobile schedule2 menus.
 */
export interface NavigationData {
    areas: NavigationArea[];
    dutyBooks: NavigationDutyBook[];
    eventSlug: string;
    hasActiveShift: boolean;
    hasKnowledgeBase: boolean;
    hasShifts: boolean;
    helpRequests?: { pending: number };
}

/**
 * Resolves `pathname` relative to `/schedule2/[event]`.
 */
export function getRelativeNavigationPath(pathname: string, eventSlug?: string): string {
    const baseUrl = eventSlug ? `/schedule2/${eventSlug}` : '';
    return baseUrl && pathname.startsWith(baseUrl) ? pathname.slice(baseUrl.length) : '';
}

/**
 * Determines directional view-transition types (`nav-forward` / `nav-back`) between top-level
 * schedule2 sections based on their spatial order.
 */
export function getNavigationTransitionTypes(
    relativePathname: string, targetSegment: string): string[] | undefined
{
    const currentIndex = kNavigationSectionOrder.findIndex(segment =>
        segment === '' ? relativePathname === '' : relativePathname.startsWith(segment));
    const targetIndex = kNavigationSectionOrder.indexOf(targetSegment);

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
        return undefined;

    return targetIndex > currentIndex ? [ 'nav-forward' ] : [ 'nav-back' ];
}

/**
 * Primary tabs available in the mobile floating bottom navigation pill (maximum of four items).
 */
export type MobileNavigationTab = 'overview' | 'shifts' | 'areas' | 'more';

/**
 * Resolves the active mobile bottom navigation tab from a relative schedule2 pathname.
 */
export function getActiveMobileTab(relativePathname: string): MobileNavigationTab {
    if (relativePathname === '' || relativePathname === '/')
        return 'overview';
    if (relativePathname.startsWith('/shifts'))
        return 'shifts';
    if (relativePathname.startsWith('/areas'))
        return 'areas';

    return 'more';
}

/**
 * Computes the total urgent activity count across secondary routes housed inside the mobile "More"
 * sheet (unread Duty Book entries + pending Help Requests).
 */
export function getMoreMenuActivityCount(data?: NavigationData): number {
    if (!data)
        return 0;

    const unreadDutyBooks = data.dutyBooks.reduce((sum, entry) => sum + entry.unread, 0);
    const pendingHelpRequests = data.helpRequests?.pending ?? 0;

    return unreadDutyBooks + pendingHelpRequests;
}
