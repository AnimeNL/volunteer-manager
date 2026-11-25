// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Suspense, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

/**
 * Spatial order of mobile navigation tabs for directional view transitions.
 */
const kTabOrder = [ '', 'shifts', 'areas', 'knowledge', 'volunteers' ];

/**
 * Fixed bottom bar container anchored across view transitions.
 */
const MobileNavigationContainer = styled(Paper)({
    bottom: 0,
    left: 0,
    position: 'fixed',
    right: 0,
    viewTransitionName: 'schedule2-mobile-nav',
    zIndex: 2,
});

/**
 * Props accepted by the <MobileNavigationBar> component.
 */
interface MobileNavigationBarProps {
    /**
     * Handler invoked when a navigation destination is chosen.
     */
    onChange?: (event: React.SyntheticEvent, value: string) => void;

    /**
     * Active navigation segment, or undefined during static App Shell prerendering.
     */
    value?: string;
}

/**
 * Renders the mobile bottom navigation items. Used both as the static `<Suspense>` fallback and for
 * the live route-aware bar to avoid any layout shift.
 */
function MobileNavigationBar(props: MobileNavigationBarProps) {
    return (
        <BottomNavigation onChange={props.onChange} value={props.value ?? ''}>
            <BottomNavigationAction icon={ <HomeIcon /> } label="Overview" value="" />
            <BottomNavigationAction icon={ <AccessTimeIcon /> } label="You" value="shifts" />
            <BottomNavigationAction icon={ <EventNoteIcon /> } label="Events" value="areas" />
            <BottomNavigationAction disabled icon={ <InfoOutlinedIcon /> } label="FAQ"
                                    value="knowledge" />
            <BottomNavigationAction disabled icon={ <GroupIcon /> } label="Volunteers"
                                    value="volunteers" />
        </BottomNavigation>
    );
}

/**
 * Leaf client component that reads dynamic route params and pathname inside `<Suspense>`.
 */
function RouteAwareMobileNavigationBar() {
    const params = useParams<{ event?: string }>();
    const pathname = usePathname();
    const router = useRouter();

    const slug = typeof params.event === 'string' ? params.event : undefined;
    const baseUrl = slug ? `/schedule2/${slug}` : '';
    const value = baseUrl && pathname.startsWith(baseUrl)
        ? pathname.slice(baseUrl.length + 1).replace(/\/.*$/, '')
        : '';

    const handleNavigation = useCallback((_event: React.SyntheticEvent, nextValue: string) => {
        if (!baseUrl || nextValue === value)
            return;

        const currentIndex = kTabOrder.indexOf(value);
        const nextIndex = kTabOrder.indexOf(nextValue);
        const transitionTypes = currentIndex >= 0 && nextIndex >= 0
            ? [ nextIndex > currentIndex ? 'nav-forward' : 'nav-back' ]
            : undefined;

        const destination = nextValue === '' ? baseUrl : `${baseUrl}/${nextValue}`;
        router.push(destination, { transitionTypes });
    }, [ baseUrl, router, value ]);

    return <MobileNavigationBar onChange={handleNavigation} value={value} />;
}

/**
 * Fixed mobile bottom navigation for the `app/schedule2/` App Shell, anchored across view
 * transitions.
 */
export function MobileNavigation() {
    return (
        <MobileNavigationContainer elevation={3} square>
            <Suspense fallback={ <MobileNavigationBar /> }>
                <RouteAwareMobileNavigationBar />
            </Suspense>
        </MobileNavigationContainer>
    );
}
