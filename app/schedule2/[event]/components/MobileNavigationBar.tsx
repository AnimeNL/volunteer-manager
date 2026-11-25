// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AppsIcon from '@mui/icons-material/Apps';
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
import { getActiveMobileTab, getNavigationTransitionTypes,
    getRelativeNavigationPath, getSchedulePath } from '../lib/navigationTypes';

/**
 * Props accepted by the route-aware <MobileNavigationBar> client component.
 */
interface MobileNavigationBarProps {
    data?: NavigationData;
}

/**
 * Route-aware mobile floating pill bar with active-only labels and the `<MobileMoreSheet>` bottom
 * drawer for secondary routes.
 */
export function MobileNavigationBar(props: MobileNavigationBarProps) {
    const { data } = props;

    const params = useParams<{ event?: string }>();
    const pathname = usePathname();
    const router = useRouter();

    const [ moreOpen, setMoreOpen ] = useState<boolean>(false);

    const slug = data?.eventSlug ?? (typeof params.event === 'string' ? params.event : undefined);
    const relativePathname = getRelativeNavigationPath(pathname, slug);
    const activeTab = getActiveMobileTab(relativePathname);

    function handleSelect(tab: MobileNavigationTab) {
        if (tab === 'more') {
            setMoreOpen(true);
            return;
        }

        if (!slug)
            return;

        const targetSegment = tab === 'overview' ? '' : `/${tab}`;
        const destination = getSchedulePath(slug, targetSegment);
        if (destination === pathname)
            return;

        const transitionTypes = getNavigationTransitionTypes(relativePathname, targetSegment);
        router.push(destination, { transitionTypes });
    }

    return (
        <>
            <MobileFloatingPill
                activeTab={moreOpen ? 'more' : activeTab}
                onSelect={handleSelect}
                showShifts={data?.hasShifts ?? false} />

            <MobileMoreSheet
                data={data}
                onClose={() => setMoreOpen(false)}
                open={moreOpen}
                relativePathname={relativePathname} />
        </>
    );
}

/**
 * Props accepted by the static <MobileFloatingPill> presenter.
 */
interface MobileFloatingPillProps {
    activeTab: MobileNavigationTab;
    onSelect?: (tab: MobileNavigationTab) => void;
    showShifts?: boolean;
}

/**
 * Stateless presenter for the M3 Expressive floating pill bar. Shared between the static
 * `<Suspense>` fallback and the route-aware live bar to prevent layout shift.
 */
export function MobileFloatingPill(props: MobileFloatingPillProps) {
    const { activeTab, onSelect, showShifts = false } = props;

    const tabs: {
        ariaLabel?: string;
        icon: React.ReactNode;
        id: MobileNavigationTab;
        label: string;
        visible: boolean;
    }[] = [
        {
            id: 'overview',
            label: 'Overview',
            icon: activeTab === 'overview'
                ? <HomeIcon fontSize="small" />
                : <HomeOutlinedIcon fontSize="small" />,
            visible: true,
        },
        {
            id: 'shifts',
            label: 'Schedule',
            ariaLabel: 'Your schedule',
            icon: <AccessTimeIcon fontSize="small" />,
            visible: showShifts,
        },
        {
            id: 'areas',
            label: 'Events',
            icon: activeTab === 'areas'
                ? <EventNoteIcon fontSize="small" />
                : <EventNoteOutlinedIcon fontSize="small" />,
            visible: true,
        },
        {
            id: 'more',
            label: 'More',
            icon: <AppsIcon fontSize="small" />,
            visible: true,
        },
    ];

    return (
        <FloatingNavHost>
            <FloatingPill component="nav" aria-label="Primary navigation" elevation={0}>
                { tabs.filter(tab => tab.visible).map(tab => {
                    const active = activeTab === tab.id;
                    return (
                        <NavPillButton
                            key={tab.id}
                            active={active}
                            aria-current={active ? 'page' : undefined}
                            aria-label={tab.ariaLabel ?? tab.label}
                            onClick={onSelect ? () => onSelect(tab.id) : undefined}>
                            {tab.icon}
                            { active &&
                                <Typography variant="caption">
                                    {tab.label}
                                </Typography> }
                        </NavPillButton>
                    );
                }) }
            </FloatingPill>
        </FloatingNavHost>
    );
}

/**
 * Fixed bottom wrapper centering the M3 Expressive floating navigation pill across view
 * transitions.
 */
const FloatingNavHost = styled(Box)(({ theme }) => ({
    bottom: `calc(${theme.spacing(1.5)} + env(safe-area-inset-bottom, 0px))`,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    pointerEvents: 'none',
    position: 'fixed',
    right: 0,
    viewTransitionName: 'schedule-mobile-nav',
    zIndex: 1100,
}));

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
        color: palette.text.secondary,
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
                    backgroundColor: palette.secondary.main,
                    color: palette.secondary.contrastText,
                    paddingLeft: theme.spacing(2),
                    paddingRight: theme.spacing(2),
                },
            },
        ],
    };
});
