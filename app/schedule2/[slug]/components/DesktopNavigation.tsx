// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams, usePathname } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Box from '@mui/material/Box';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { darken } from '@mui/material/styles';

import { kDefaultThemePalette, kDesktopMenuWidthPx } from '../Constants';

/**
 * Styling for the <DesktopNavigation> sidebar, matching the legacy schedule portal's proportions.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    container: {
        paddingLeft: 2,
        paddingRight: 0,
        paddingY: 1,
    },

    header: {
        backgroundColor: 'background.paper',
        borderRadius: 1,
        height: `${kDesktopMenuWidthPx / 2}px`,
        marginBottom: 0.75,
        marginLeft: 2,
        marginTop: 2,
        overflow: 'hidden',
        width: `${kDesktopMenuWidthPx - 32}px`,
    },

    item: {
        borderRadius: theme => theme.spacing(1),
        marginBottom: 1,
    },
};

/**
 * Precomputed query parameters for the tinted schedule logo SVG.
 */
const kLogoUrl = '/images/logo.svg?' + new URLSearchParams([
    [ 'color', darken(kDefaultThemePalette.light, 0.3) ],
    [ 'title', /* empty= */ '' ],
]);

/**
 * Navigation entries shown in the desktop sidebar shell, ordered spatially for directional view
 * transitions.
 */
const kNavigationItems = [
    { icon: <HomeIcon />, label: 'Overview', segment: '' },
    { icon: <AccessTimeIcon />, label: 'Your schedule', segment: '/shifts' },
    { icon: <EventNoteIcon />, label: 'Events', segment: '/areas' },
    { icon: <InfoOutlinedIcon />, label: 'Knowledge base', segment: '/knowledge', disabled: true },
    { icon: <GroupIcon />, label: 'Volunteers', segment: '/volunteers', disabled: true },
];

/**
 * Determines directional view-transition types based on the spatial order of navigation entries.
 */
function getTransitionTypes(currentIndex: number, targetIndex: number): string[] | undefined {
    if (currentIndex < 0 || currentIndex === targetIndex)
        return undefined;

    return targetIndex > currentIndex ? [ 'nav-forward' ] : [ 'nav-back' ];
}

/**
 * Props accepted by the <DesktopNavigationList> component.
 */
interface DesktopNavigationListProps {
    /**
     * Current pathname relative to `/schedule2/[slug]`, when resolved on the client.
     */
    relativePathname?: string;

    /**
     * Current event slug, when resolved from route params inside `<Suspense>`.
     */
    slug?: string;
}

/**
 * Renders the sidebar navigation items. When `slug` is omitted (during static App Shell
 * prerendering), renders the exact same visual list without URL-dependent links or active state.
 */
function DesktopNavigationList(props: DesktopNavigationListProps) {
    const { relativePathname, slug } = props;

    const activeIndex = relativePathname === undefined
        ? -1
        : kNavigationItems.findIndex(item =>
            item.segment === ''
                ? relativePathname === ''
                : relativePathname.startsWith(item.segment));

    return (
        <List sx={kStyles.container}>
            { kNavigationItems.map((item, index) => {
                const isActive = index === activeIndex;

                if (!slug || item.disabled) {
                    return (
                        <ListItemButton key={item.label} disabled={item.disabled}
                                        selected={isActive} sx={kStyles.item}>
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    );
                }

                return (
                    <ListItemButton key={item.label} component={Link}
                                    href={`/schedule2/${slug}${item.segment}`}
                                    selected={isActive} sx={kStyles.item}
                                    transitionTypes={getTransitionTypes(activeIndex, index)}>
                        <ListItemIcon>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>
                );
            }) }
        </List>
    );
}

/**
 * Leaf client component that reads dynamic route params and pathname inside `<Suspense>`.
 */
function RouteAwareDesktopNavigationList() {
    const params = useParams<{ slug?: string }>();
    const pathname = usePathname();

    const slug = typeof params.slug === 'string' ? params.slug : undefined;
    const baseUrl = slug ? `/schedule2/${slug}` : '';
    const relativePathname = baseUrl && pathname.startsWith(baseUrl)
        ? pathname.slice(baseUrl.length)
        : '';

    return <DesktopNavigationList relativePathname={relativePathname} slug={slug} />;
}

/**
 * Desktop sidebar navigation for the `app/schedule2/` App Shell.
 */
export function DesktopNavigation() {
    return (
        <>
            <Box sx={kStyles.header}>
                <object type="image/svg+xml" style={{ marginTop: '-35px' }} data={kLogoUrl} />
            </Box>
            <Suspense fallback={ <DesktopNavigationList /> }>
                <RouteAwareDesktopNavigationList />
            </Suspense>
        </>
    );
}
