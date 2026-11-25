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
            <BottomNavigationAction disabled icon={ <AccessTimeIcon /> } label="You"
                                    value="shifts" />
            <BottomNavigationAction disabled icon={ <EventNoteIcon /> } label="Events"
                                    value="areas" />
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
    const params = useParams<{ slug?: string }>();
    const pathname = usePathname();
    const router = useRouter();

    const slug = typeof params.slug === 'string' ? params.slug : undefined;
    const baseUrl = slug ? `/schedule2/${slug}` : '';
    const value = baseUrl && pathname.startsWith(baseUrl)
        ? pathname.slice(baseUrl.length + 1).replace(/\/.*$/, '')
        : '';

    const handleNavigation = useCallback((_event: React.SyntheticEvent, nextValue: string) => {
        if (!baseUrl)
            return;

        if (nextValue === '')
            router.push(baseUrl);
    }, [ baseUrl, router ]);

    return <MobileNavigationBar onChange={handleNavigation} value={value} />;
}

/**
 * Fixed mobile bottom navigation for the `app/schedule2/` App Shell, anchored across view
 * transitions.
 */
export function MobileNavigation() {
    return (
        <Paper elevation={3} sx={{
            bottom: 0,
            left: 0,
            position: 'fixed',
            right: 0,
            viewTransitionName: 'schedule2-mobile-nav',
            zIndex: 2,
        }}>
            <Suspense fallback={ <MobileNavigationBar /> }>
                <RouteAwareMobileNavigationBar />
            </Suspense>
        </Paper>
    );
}
