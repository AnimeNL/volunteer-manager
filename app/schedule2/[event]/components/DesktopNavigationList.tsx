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
import { ExpandableNavigationSection, NavigationLink, SecondaryNavigationItems } from './NavigationList';
import { getNavigationTransitionTypes, getRelativeNavigationPath, getSchedulePath,
    isNavigationPathActive } from '../lib/navigationTypes';

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
    const { areas, eventSlug, expandEvents, hasShifts } = props.data;

    const pathname = usePathname();
    const relativePathname = getRelativeNavigationPath(pathname, eventSlug);

    const areaItems: NavigationSubItem[] = areas.map(area => {
        const path = `/areas/${area.id}`;
        return {
            href: getSchedulePath(eventSlug, path),
            key: area.id,
            label: area.name,
            selected: isNavigationPathActive(relativePathname, path),
        };
    });

    return (
        <>
            { hasShifts &&
                <NavigationLink
                    href={getSchedulePath(eventSlug, '/shifts')}
                    icon={ <AccessTimeIcon fontSize="small" /> }
                    label="Your schedule"
                    selected={isNavigationPathActive(relativePathname, '/shifts')}
                    transitionTypes={
                        getNavigationTransitionTypes(relativePathname, '/shifts')
                    } /> }

            <ExpandableNavigationSection
                activeIcon={ <EventNoteIcon fontSize="small" /> }
                defaultExpanded={expandEvents}
                expandLabel="areas"
                href={getSchedulePath(eventSlug, '/areas')}
                icon={ <EventNoteOutlinedIcon fontSize="small" /> }
                items={areaItems}
                label="Events"
                sectionId="events"
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
            href={eventSlug ? getSchedulePath(eventSlug) : undefined}
            icon={ <HomeOutlinedIcon fontSize="small" /> }
            label="Overview"
            selected={relativePathname !== undefined && isNavigationPathActive(relativePathname, '')}
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
