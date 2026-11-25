// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AppsIcon from '@mui/icons-material/Apps';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { MobileNavigationTab, NavigationData } from '../lib/navigationTypes';
import { MobileMoreSheet } from './MobileMoreSheet';
import { getActiveMobileTab, getMoreMenuActivityCount, getNavigationTransitionTypes,
    getRelativeNavigationPath } from '../lib/navigationTypes';

import { kShellSpacingPx } from '../Constants';

/**
 * Fixed bottom wrapper centering the M3 Expressive floating navigation pill across view
 * transitions.
 */
const FloatingNavHost = styled(Box)({
    bottom: `calc(${kShellSpacingPx}px + env(safe-area-inset-bottom, 0px))`,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    pointerEvents: 'none',
    position: 'fixed',
    right: 0,
    viewTransitionName: 'schedule2-mobile-nav',
    zIndex: 1100,
});

/**
 * Elevated M3 Expressive floating navigation pill container.
 */
const FloatingPill = styled(Paper)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: palette.m3.floatingNav,
        borderRadius: 9999,
        boxShadow: '0 6px 20px rgba(24, 29, 21, 0.14), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
        display: 'inline-flex',
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.75),
        pointerEvents: 'auto',

        ...theme.applyStyles('dark', {
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.48), inset 0 0 0 1px rgba(255, 255, 255, 0.07)',
        }),
    };
}) as typeof Paper;

/**
 * Individual destination button inside the floating pill. Displays only an icon when inactive, and
 * expands into a `secondaryContainer` pill with its label when active.
 */
const NavPillButton = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'active',
})<{ active: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        borderRadius: 9999,
        color: palette.m3.onSurfaceVariant,
        display: 'inline-flex',
        gap: theme.spacing(0.75),
        height: 40,
        justifyContent: 'center',
        minWidth: 44,
        paddingLeft: theme.spacing(1.25),
        paddingRight: theme.spacing(1.25),
        transition: theme.transitions.create([ 'background-color', 'color', 'padding' ], {
            duration: theme.transitions.duration.shorter,
        }),

        '&.Mui-disabled': {
            opacity: 0.4,
        },

        variants: [
            {
                props: { active: true },
                style: {
                    backgroundColor: palette.m3.secondaryContainer,
                    color: palette.m3.onSecondaryContainer,
                    paddingLeft: theme.spacing(2),
                    paddingRight: theme.spacing(2),
                },
            },
        ],
    };
});

/**
 * Props accepted by the static <MobileFloatingPill> presenter.
 */
interface MobileFloatingPillProps {
    activeTab: MobileNavigationTab;
    hasActiveShift?: boolean;
    moreActivityCount?: number;
    onSelect?: (tab: MobileNavigationTab) => void;
    shiftsDisabled?: boolean;
}

/**
 * Stateless presenter for the 4-item M3 Expressive floating pill bar. Shared between the static
 * `<Suspense>` fallback and the route-aware live bar to prevent layout shift.
 */
export function MobileFloatingPill(props: MobileFloatingPillProps) {
    const {
        activeTab,
        hasActiveShift = false,
        moreActivityCount = 0,
        onSelect,
        shiftsDisabled = false,
    } = props;

    return (
        <FloatingNavHost>
            <FloatingPill component="nav" aria-label="Primary navigation" elevation={0}>
                <NavPillButton
                    active={activeTab === 'overview'}
                    aria-current={activeTab === 'overview' ? 'page' : undefined}
                    aria-label="Overview"
                    onClick={onSelect ? () => onSelect('overview') : undefined}>
                    { activeTab === 'overview'
                        ? <HomeIcon fontSize="small" />
                        : <HomeOutlinedIcon fontSize="small" /> }
                    { activeTab === 'overview' &&
                        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>
                            Overview
                        </Typography> }
                </NavPillButton>

                <NavPillButton
                    active={activeTab === 'shifts'}
                    aria-current={activeTab === 'shifts' ? 'page' : undefined}
                    aria-label="Your schedule"
                    disabled={shiftsDisabled}
                    onClick={onSelect ? () => onSelect('shifts') : undefined}>
                    <Badge color="success" invisible={!hasActiveShift} variant="dot">
                        <AccessTimeIcon fontSize="small" />
                    </Badge>
                    { activeTab === 'shifts' &&
                        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>
                            Schedule
                        </Typography> }
                </NavPillButton>

                <NavPillButton
                    active={activeTab === 'areas'}
                    aria-current={activeTab === 'areas' ? 'page' : undefined}
                    aria-label="Events"
                    onClick={onSelect ? () => onSelect('areas') : undefined}>
                    { activeTab === 'areas'
                        ? <EventNoteIcon fontSize="small" />
                        : <EventNoteOutlinedIcon fontSize="small" /> }
                    { activeTab === 'areas' &&
                        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>
                            Events
                        </Typography> }
                </NavPillButton>

                <NavPillButton
                    active={activeTab === 'more'}
                    aria-current={activeTab === 'more' ? 'page' : undefined}
                    aria-label={moreActivityCount > 0
                        ? `More (${moreActivityCount} active items)`
                        : 'More'}
                    onClick={onSelect ? () => onSelect('more') : undefined}>
                    <Badge badgeContent={moreActivityCount} color="error" max={99}>
                        <AppsIcon fontSize="small" />
                    </Badge>
                    { activeTab === 'more' &&
                        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>
                            More
                        </Typography> }
                </NavPillButton>
            </FloatingPill>
        </FloatingNavHost>
    );
}

/**
 * Props accepted by the route-aware <MobileNavigationBar> client component.
 */
export interface MobileNavigationBarProps {
    data?: NavigationData;
    eventBannerUrl?: string;
    eventName?: string;
}

/**
 * Route-aware mobile floating pill bar with active-only labels, More activity badge, and the
 * `<MobileMoreSheet>` bottom drawer for secondary routes.
 */
export function MobileNavigationBar(props: MobileNavigationBarProps) {
    const { data, eventBannerUrl, eventName } = props;

    const params = useParams<{ event?: string }>();
    const pathname = usePathname();
    const router = useRouter();

    const [ moreOpen, setMoreOpen ] = useState<boolean>(false);

    const slug = data?.eventSlug ?? (typeof params.event === 'string' ? params.event : undefined);
    const relativePathname = getRelativeNavigationPath(pathname, slug);
    const activeTab = getActiveMobileTab(relativePathname);
    const moreActivityCount = getMoreMenuActivityCount(data);

    const handleSelect = useCallback((tab: MobileNavigationTab) => {
        if (tab === 'more') {
            setMoreOpen(true);
            return;
        }

        if (!slug)
            return;

        const targetSegment = tab === 'overview' ? '' : `/${tab}`;
        const destination = targetSegment ? `/schedule2/${slug}${targetSegment}` : `/schedule2/${slug}`;
        if (destination === pathname)
            return;

        const transitionTypes = getNavigationTransitionTypes(relativePathname, targetSegment);
        router.push(destination, { transitionTypes });
    }, [ pathname, relativePathname, router, slug ]);

    const handleCloseMore = useCallback(() => setMoreOpen(false), []);

    return (
        <>
            <MobileFloatingPill
                activeTab={moreOpen ? 'more' : activeTab}
                hasActiveShift={data?.hasActiveShift}
                moreActivityCount={moreActivityCount}
                onSelect={handleSelect}
                shiftsDisabled={data !== undefined && !data.hasShifts} />

            <MobileMoreSheet
                data={data}
                eventBannerUrl={eventBannerUrl}
                eventName={eventName}
                eventSlug={slug}
                onClose={handleCloseMore}
                open={moreOpen}
                relativePathname={relativePathname} />
        </>
    );
}
