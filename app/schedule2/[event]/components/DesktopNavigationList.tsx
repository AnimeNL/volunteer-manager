// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Suspense } from 'react';
import { useParams, usePathname } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import List from '@mui/material/List';

import type { NavigationData } from '../lib/navigationTypes';
import type { NavigationSubItem } from './NavigationList';
import { ActivityDot, ExpandableNavigationSection, NavigationLink,
    SecondaryNavigationItems } from './NavigationList';
import { getNavigationTransitionTypes, getRelativeNavigationPath } from '../lib/navigationTypes';

/**
 * Route-aware desktop sidebar list. Renders Overview immediately in the static App Shell, and
 * accepts streamed volunteer-specific items via `children`.
 */
export function DesktopNavigationList(props: React.PropsWithChildren) {
    return (
        <List disablePadding>
            <Suspense fallback={ <OverviewItem /> }>
                <RouteAwareOverviewItem />
            </Suspense>
            {props.children}
        </List>
    );
}

/**
 * Renders volunteer-specific desktop sidebar entries streamed in behind `<Suspense>`.
 */
export function VolunteerNavigationItems(props: { data: NavigationData }) {
    const { areas, eventSlug, hasActiveShift, hasShifts } = props.data;

    const pathname = usePathname();
    const relativePathname = getRelativeNavigationPath(pathname, eventSlug);

    const totalActiveEvents = areas.reduce((sum, area) => sum + area.activeCount, 0);
    const areaItems: NavigationSubItem[] = areas.map(area => {
        const path = `/areas/${area.id}`;
        return {
            badge: area.activeCount,
            badgeLabel: `${area.activeCount} active events`,
            href: `/schedule2/${eventSlug}${path}`,
            key: area.id,
            label: area.name,
            selected: relativePathname === path || relativePathname.startsWith(`${path}/`),
        };
    });

    return (
        <>
            { hasShifts &&
                <NavigationLink
                    badge={ hasActiveShift
                        ? <ActivityDot aria-label="Active shift" title="Active shift" />
                        : undefined }
                    href={`/schedule2/${eventSlug}/shifts`}
                    icon={ <AccessTimeIcon fontSize="small" /> }
                    label="Your schedule"
                    selected={relativePathname.startsWith('/shifts')}
                    transitionTypes={
                        getNavigationTransitionTypes(relativePathname, '/shifts')
                    } /> }

            <ExpandableNavigationSection
                activeIcon={ <EventNoteIcon fontSize="small" /> }
                badge={totalActiveEvents}
                badgeLabel={`${totalActiveEvents} active events`}
                defaultExpanded
                expandLabel="areas"
                href={`/schedule2/${eventSlug}/areas`}
                icon={ <EventNoteOutlinedIcon fontSize="small" /> }
                items={areaItems}
                label="Events"
                selected={relativePathname === '/areas'}
                transitionTypes={getNavigationTransitionTypes(relativePathname, '/areas')} />

            <SecondaryNavigationItems data={props.data} relativePathname={relativePathname} />
        </>
    );
}

/**
 * Renders the always-visible Overview entry. Used both as the static `<Suspense>` fallback and for
 * the live route-aware item to prevent layout shift.
 */
function OverviewItem(props: { eventSlug?: string; relativePathname?: string }) {
    const { eventSlug, relativePathname } = props;

    return (
        <NavigationLink
            activeIcon={ <HomeIcon fontSize="small" /> }
            href={eventSlug ? `/schedule2/${eventSlug}` : undefined}
            icon={ <HomeOutlinedIcon fontSize="small" /> }
            label="Overview"
            selected={relativePathname === ''}
            transitionTypes={relativePathname ? [ 'nav-back' ] : undefined} />
    );
}

/**
 * Leaf client component reading dynamic route params and pathname for the Overview item.
 */
function RouteAwareOverviewItem() {
    const params = useParams<{ event?: string }>();
    const pathname = usePathname();

    const eventSlug = typeof params.event === 'string' ? params.event : undefined;
    const relativePathname = getRelativeNavigationPath(pathname, eventSlug);

    return <OverviewItem eventSlug={eventSlug} relativePathname={relativePathname} />;
}
