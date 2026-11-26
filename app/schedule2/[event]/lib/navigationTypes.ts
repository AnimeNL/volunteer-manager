// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Spatial order of top-level schedule navigation segments for directional view transitions.
 */
const kNavigationSectionOrder = [
    '', '/shifts', '/areas', '/duty-book', '/help-requests', '/knowledge', '/volunteers',
    '/settings', '/hotel', '/ticket', '/feedback', '/vendors',
];

/**
 * Program area summary rendered in schedule navigation menus.
 */
export interface NavigationArea {
    id: number;
    name: string;
}

/**
 * Team-scoped Duty Book summary rendered in schedule navigation menus.
 */
interface NavigationDutyBook {
    name: string;
    team: string;
}

/**
 * Serializable navigation state shared between desktop and mobile schedule menus.
 */
export interface NavigationData {
    areas: NavigationArea[];
    dutyBooks: NavigationDutyBook[];
    eventSlug: string;
    expandDutyBook: boolean;
    expandEvents: boolean;
    hasHelpRequests: boolean;
    hasKnowledgeBase: boolean;
}

/**
 * Builds an absolute URL path within the event schedule portal.
 */
export function getSchedulePath(eventSlug: string, segment?: string): string {
    return segment ? `/schedule2/${eventSlug}${segment}` : `/schedule2/${eventSlug}`;
}

/**
 * Resolves `pathname` relative to the event schedule root, normalizing a trailing slash to `''`.
 */
export function getRelativeNavigationPath(pathname: string, eventSlug?: string): string {
    const baseUrl = eventSlug ? getSchedulePath(eventSlug) : '';
    if (!baseUrl || !pathname.startsWith(baseUrl))
        return '';

    const relative = pathname.slice(baseUrl.length);
    return relative === '/' ? '' : relative;
}

/**
 * Returns whether `relativePathname` matches `targetPath` exactly or as a descendant path segment.
 */
export function isNavigationPathActive(relativePathname: string, targetPath: string): boolean {
    if (targetPath === '')
        return relativePathname === '';

    return relativePathname === targetPath || relativePathname.startsWith(`${targetPath}/`);
}

/**
 * Determines directional view-transition types (`nav-forward` / `nav-back`) between top-level
 * schedule sections based on their spatial order.
 */
export function getNavigationTransitionTypes(
    relativePathname: string, targetSegment: string): string[] | undefined
{
    const currentIndex = kNavigationSectionOrder.findIndex(segment =>
        isNavigationPathActive(relativePathname, segment));
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
 * Resolves the active mobile bottom navigation tab from a relative schedule pathname.
 */
export function getActiveMobileTab(relativePathname: string): MobileNavigationTab {
    if (isNavigationPathActive(relativePathname, ''))
        return 'overview';
    if (isNavigationPathActive(relativePathname, '/shifts'))
        return 'shifts';
    if (isNavigationPathActive(relativePathname, '/areas'))
        return 'areas';

    return 'more';
}
