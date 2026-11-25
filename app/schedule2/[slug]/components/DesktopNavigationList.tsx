// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams, usePathname } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { styled } from '@mui/material/styles';

/**
 * Spatial order of top-level navigation segments for directional view transitions.
 */
const kSectionOrder = [ '', '/shifts' ];

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
 * Green activity indicator dot displayed when the signed-in volunteer has a currently active shift.
 */
const ActivityDot = styled('span')(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.success.main,
        borderRadius: '50%',
        boxShadow: `0 0 0 3px color-mix(in srgb, ${palette.success.main} 25%, transparent)`,
        flexShrink: 0,
        height: 8,
        width: 8,
    };
});

/**
 * Resolves the relative pathname under `/schedule2/[slug]`.
 */
function getRelativePathname(pathname: string, slug?: string): string {
    const baseUrl = slug ? `/schedule2/${slug}` : '';
    return baseUrl && pathname.startsWith(baseUrl) ? pathname.slice(baseUrl.length) : '';
}

/**
 * Determines directional view-transition types between top-level sidebar sections.
 */
function getTransitionTypes(relativePathname: string, targetSegment: string): string[] | undefined {
    const currentIndex = kSectionOrder.findIndex(segment =>
        segment === '' ? relativePathname === '' : relativePathname.startsWith(segment));
    const targetIndex = kSectionOrder.indexOf(targetSegment);

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
        return undefined;

    return targetIndex > currentIndex ? [ 'nav-forward' ] : [ 'nav-back' ];
}

/**
 * Props accepted by the <OverviewItem> component.
 */
interface OverviewItemProps {
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
 * Renders the always-visible Overview entry. Used both as the static `<Suspense>` fallback and for
 * the live route-aware item to prevent layout shift.
 */
function OverviewItem(props: OverviewItemProps) {
    const { relativePathname, slug } = props;

    const isActive = relativePathname === '';
    const icon = isActive
        ? <HomeIcon fontSize="small" />
        : <HomeOutlinedIcon fontSize="small" />;

    if (!slug) {
        return (
            <NavigationItem selected={isActive}>
                <ListItemIcon>
                    {icon}
                </ListItemIcon>
                <ListItemText primary="Overview" />
            </NavigationItem>
        );
    }

    return (
        <NavigationItem component={Link} href={`/schedule2/${slug}`}
                        selected={isActive}
                        transitionTypes={relativePathname ? [ 'nav-back' ] : undefined}>
            <ListItemIcon>
                {icon}
            </ListItemIcon>
            <ListItemText primary="Overview" />
        </NavigationItem>
    );
}

/**
 * Leaf client component reading dynamic route params and pathname for the Overview item.
 */
function RouteAwareOverviewItem() {
    const params = useParams<{ slug?: string }>();
    const pathname = usePathname();

    const slug = typeof params.slug === 'string' ? params.slug : undefined;
    const relativePathname = getRelativePathname(pathname, slug);

    return <OverviewItem relativePathname={relativePathname} slug={slug} />;
}

/**
 * Props accepted by the <VolunteerNavigationItems> component.
 */
interface VolunteerNavigationItemsProps {
    /**
     * Whether the signed-in volunteer currently has an active shift.
     */
    hasActiveShift: boolean;

    /**
     * Whether the signed-in volunteer has at least one scheduled shift for this event.
     */
    hasShifts: boolean;

    /**
     * Event slug for building navigation destinations.
     */
    slug: string;
}

/**
 * Renders volunteer-specific desktop sidebar entries streamed in behind `<Suspense>`.
 */
export function VolunteerNavigationItems(props: VolunteerNavigationItemsProps) {
    const { hasActiveShift, hasShifts, slug } = props;
    const pathname = usePathname();
    const relativePathname = getRelativePathname(pathname, slug);

    const isShiftsActive = relativePathname.startsWith('/shifts');

    return (
        <>
            { hasShifts &&
                <NavigationItem component={Link} href={`/schedule2/${slug}/shifts`}
                                selected={isShiftsActive}
                                transitionTypes={getTransitionTypes(relativePathname, '/shifts')}>
                    <ListItemIcon>
                        <AccessTimeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Your schedule" />
                    { hasActiveShift &&
                        <ActivityDot aria-label="Active shift" title="Active shift" /> }
                </NavigationItem> }
        </>
    );
}

/**
 * Route-aware desktop sidebar list. Renders Overview immediately in the static App Shell, and
 * accepts streamed volunteer-specific items via `children`.
 */
export function DesktopNavigationList(props: React.PropsWithChildren) {
    return (
        <List sx={{ paddingLeft: 2, paddingRight: 0, paddingY: 1 }}>
            <Suspense fallback={ <OverviewItem /> }>
                <RouteAwareOverviewItem />
            </Suspense>
            {props.children}
        </List>
    );
}
