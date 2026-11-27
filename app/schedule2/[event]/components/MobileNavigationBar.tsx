// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useState } from 'react';
import { useParams, usePathname } from 'next/navigation';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AppsIcon from '@mui/icons-material/Apps';
import ButtonBase from '@mui/material/ButtonBase';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { MobileNavigationTab, NavigationData } from '../lib/navigationTypes';
import { MobileMoreSheet } from './MobileMoreSheet';
import { floatingPillShadow } from '../lib/scheduleStyles';
import { getActiveMobileTab, getRelativeNavigationPath,
    getSchedulePath } from '../lib/navigationTypes';

import { kPillBorderRadius } from '../Constants';

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

    const [ moreOpen, setMoreOpen ] = useState<boolean>(false);

    const slug = data?.eventSlug ?? (typeof params.event === 'string' ? params.event : undefined);
    const relativePathname = getRelativeNavigationPath(pathname, slug);
    const activeTab = getActiveMobileTab(relativePathname);

    return (
        <>
            <MobileFloatingPill
                activeTab={moreOpen ? 'more' : activeTab}
                eventSlug={slug}
                onOpenMore={() => setMoreOpen(true)} />

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
    eventSlug?: string;
    onOpenMore?: () => void;
}

/**
 * Stateless presenter for the M3 Expressive floating pill bar. Shared between the static
 * `<Suspense>` fallback and the route-aware live bar to prevent layout shift.
 */
export function MobileFloatingPill(props: MobileFloatingPillProps) {
    const { activeTab, eventSlug, onOpenMore } = props;

    const tabs: {
        ariaLabel?: string;
        icon: React.ReactNode;
        id: MobileNavigationTab;
        label: string;
        segment?: string;
    }[] = [
        {
            id: 'overview',
            label: 'Overview',
            segment: '',
            icon: activeTab === 'overview'
                ? <HomeIcon fontSize="small" />
                : <HomeOutlinedIcon fontSize="small" />,
        },
        {
            id: 'shifts',
            label: 'Schedule',
            ariaLabel: 'Your schedule',
            segment: '/shifts',
            icon: <AccessTimeIcon fontSize="small" />,
        },
        {
            id: 'areas',
            label: 'Events',
            segment: '/areas',
            icon: activeTab === 'areas'
                ? <EventNoteIcon fontSize="small" />
                : <EventNoteOutlinedIcon fontSize="small" />,
        },
        {
            id: 'more',
            label: 'More',
            icon: <AppsIcon fontSize="small" />,
        },
    ];

    return (
        <Stack direction="row" sx={{
            bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            justifyContent: 'center',
            left: 0,
            pointerEvents: 'none',
            position: 'fixed',
            right: 0,
            viewTransitionName: 'schedule-mobile-nav',
            zIndex: 'appBar',
        }}>
            <FloatingPill component="nav" aria-label="Primary navigation" elevation={0}>
                { tabs.map(tab => {
                    const active = activeTab === tab.id;
                    const content = (
                        <>
                            {tab.icon}
                            { active &&
                                <Typography variant="caption">
                                    {tab.label}
                                </Typography> }
                        </>
                    );

                    if (tab.segment !== undefined && eventSlug) {
                        return (
                            <NavPillButton
                                key={tab.id}
                                active={active}
                                aria-current={active ? 'page' : undefined}
                                aria-label={tab.ariaLabel ?? tab.label}
                                component={Link}
                                href={getSchedulePath(eventSlug, tab.segment)}>
                                {content}
                            </NavPillButton>
                        );
                    }

                    return (
                        <NavPillButton
                            key={tab.id}
                            active={active}
                            aria-current={active ? 'page' : undefined}
                            aria-label={tab.ariaLabel ?? tab.label}
                            onClick={tab.id === 'more' ? onOpenMore : undefined}>
                            {content}
                        </NavPillButton>
                    );
                }) }
            </FloatingPill>
        </Stack>
    );
}

/**
 * Elevated M3 Expressive floating navigation pill container.
 */
const FloatingPill = styled(Paper)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: palette.m3.floatingNav,
        borderRadius: kPillBorderRadius,
        display: 'inline-flex',
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.75),
        pointerEvents: 'auto',
        ...floatingPillShadow(theme, 'nav'),
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
        borderRadius: kPillBorderRadius,
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
}) as ExtendButtonBase<ButtonBaseTypeMap<{ active: boolean }>>;
