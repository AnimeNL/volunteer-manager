// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams, usePathname } from 'next/navigation';

import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { styled } from '@mui/material/styles';

/**
 * Material Design 3 rounded navigation item shared across all desktop sidebar entries, matching the
 * theme's card border radius with a tonal primary active container.
 */
const NavigationItem = styled(ListItemButton)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderRadius: theme.shape.borderRadius,
        color: palette.text.primary,
        marginBottom: theme.spacing(0.5),
        minHeight: 44,
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(1.5),
        transition: theme.transitions.create([ 'background-color', 'color' ], {
            duration: theme.transitions.duration.shortest,
        }),

        '& .MuiListItemIcon-root': {
            color: palette.text.secondary,
            minWidth: 36,
        },
        '& .MuiListItemText-primary': {
            fontSize: theme.typography.body2.fontSize,
            fontWeight: 500,
        },
        '&.Mui-selected': {
            backgroundColor: `color-mix(in srgb, ${palette.primary.main} 14%, transparent)`,
            color: palette.primary.main,
            '&:hover': {
                backgroundColor: `color-mix(in srgb, ${palette.primary.main} 20%, transparent)`,
            },
            '& .MuiListItemIcon-root': {
                color: 'inherit',
            },
            '& .MuiListItemText-primary': {
                fontWeight: 600,
            },
        },

        ...theme.applyStyles('dark', {
            '&.Mui-selected': {
                backgroundColor: `color-mix(in srgb, ${palette.primary.main} 22%, transparent)`,
                color: palette.primary.light,
                '&:hover': {
                    backgroundColor: `color-mix(in srgb, ${palette.primary.main} 28%, transparent)`,
                },
            },
        }),
    };
}) as typeof ListItemButton;

/**
 * Props accepted by the <NavigationListView> component.
 */
interface NavigationListViewProps {
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
 * Renders the sidebar navigation items. Only the Overview entry is visible by default; additional
 * volunteer-specific entries will stream in conditionally in subsequent iterations.
 */
function NavigationListView(props: NavigationListViewProps) {
    const { relativePathname, slug } = props;

    const isOverviewActive = relativePathname === '';
    const overviewIcon = isOverviewActive
        ? <HomeIcon fontSize="small" />
        : <HomeOutlinedIcon fontSize="small" />;

    return (
        <List sx={{ paddingLeft: 2, paddingRight: 0, paddingY: 1 }}>
            { !slug ? (
                <NavigationItem selected={isOverviewActive}>
                    <ListItemIcon>
                        {overviewIcon}
                    </ListItemIcon>
                    <ListItemText primary="Overview" />
                </NavigationItem>
            ) : (
                <NavigationItem component={Link} href={`/schedule2/${slug}`}
                                selected={isOverviewActive}
                                transitionTypes={relativePathname ? [ 'nav-back' ] : undefined}>
                    <ListItemIcon>
                        {overviewIcon}
                    </ListItemIcon>
                    <ListItemText primary="Overview" />
                </NavigationItem>
            ) }
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

    return <NavigationListView relativePathname={relativePathname} slug={slug} />;
}

/**
 * Route-aware navigation list for the desktop sidebar, wrapped in `<Suspense>` so the App Shell
 * prerenders statically without layout shift.
 */
export function DesktopNavigationList() {
    return (
        <Suspense fallback={ <NavigationListView /> }>
            <RouteAwareDesktopNavigationList />
        </Suspense>
    );
}
