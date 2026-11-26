// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CloseIcon from '@mui/icons-material/Close';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Grid from '@mui/material/Grid';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { getNavigationTransitionTypes, getSchedulePath } from '../lib/navigationTypes';

import { kCardBorderRadiusPx } from '../Constants';

import { type OverviewActionTileId, dismissOverviewActionTile } from './OverviewActions';

/**
 * Accent slot key identifying which analogous palette tone a secondary tile uses.
 */
type TileAccentKey = 'tileAccentA' | 'tileAccentB' | 'tileAccentC';

/**
 * Definition of an actionable overview tile.
 */
interface ActionTileDefinition {
    accent: TileAccentKey;
    heroSubtitle: string;
    icon: React.ReactNode;
    id: OverviewActionTileId;
    label: string;
    segment: string;
}

/**
 * Props accepted by the <OverviewActionTiles> component.
 */
interface OverviewActionTilesProps {
    /**
     * Slug of the active event used to build schedule destination URLs.
     */
    eventSlug: string;

    /**
     * Whether the Feedback action tile should be displayed.
     */
    showFeedback: boolean;

    /**
     * Whether the Hotel action tile should be displayed.
     */
    showHotel: boolean;

    /**
     * Whether the Schedule action tile should be displayed.
     */
    showSchedule: boolean;

    /**
     * Whether the Ticket action tile should be displayed.
     */
    showTicket: boolean;
}

/**
 * Renders the Bento grid of dismissible CTA tiles on the schedule overview page. The first visible
 * tile occupies the primary-gradient hero slot, while remaining tiles render as compact analogous
 * tonal tiles.
 */
export function OverviewActionTiles(props: OverviewActionTilesProps) {
    const { eventSlug, showFeedback, showHotel, showSchedule, showTicket } = props;
    const [ dismissed, setDismissed ] = useState<ReadonlySet<OverviewActionTileId>>(
        () => new Set());

    async function handleDismiss(tileId: OverviewActionTileId) {
        setDismissed(current => new Set([ ...current, tileId ]));

        const response = await dismissOverviewActionTile(tileId);
        if (!response.success) {
            setDismissed(current => {
                const next = new Set(current);
                next.delete(tileId);
                return next;
            });
        }
    }

    const candidates: (ActionTileDefinition | false)[] = [
        showTicket && {
            accent: 'tileAccentA',
            heroSubtitle: 'Your entry to the festival',
            icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
            id: 'ticket',
            label: 'Ticket',
            segment: '/ticket',
        },
        showHotel && {
            accent: 'tileAccentA',
            heroSubtitle: 'Your hotel room',
            icon: <HotelOutlinedIcon fontSize="small" />,
            id: 'hotel',
            label: 'Hotel',
            segment: '/hotel',
        },
        showSchedule && {
            accent: 'tileAccentB',
            heroSubtitle: 'Your upcoming shifts',
            icon: <AccessTimeIcon fontSize="small" />,
            id: 'schedule',
            label: 'Schedule',
            segment: '/shifts',
        },
        showFeedback && {
            accent: 'tileAccentC',
            heroSubtitle: 'Share your thoughts',
            icon: <FeedbackOutlinedIcon fontSize="small" />,
            id: 'feedback',
            label: 'Feedback',
            segment: '/feedback',
        },
    ];

    const tiles = candidates.filter(
        (tile): tile is ActionTileDefinition => !!tile && !dismissed.has(tile.id));

    if (!tiles.length)
        return null;

    const [ hero, ...secondary ] = tiles;

    return (
        <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: secondary.length > 0 ? 5 : 12 }}>
                <Box sx={{ height: '100%', position: 'relative' }}>
                    <HeroTileButton
                        component={Link}
                        href={getSchedulePath(eventSlug, hero.segment)}
                        transitionTypes={getNavigationTransitionTypes('', hero.segment)}>
                        <Stack direction="row" spacing={1.5}
                               sx={{ alignItems: 'center', minWidth: 0, width: '100%' }}>
                            <HeroIconBadge>
                                {hero.icon}
                            </HeroIconBadge>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" noWrap
                                            sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                    {hero.label}
                                </Typography>
                                <Typography variant="caption" noWrap
                                            sx={{ display: 'block', opacity: 0.82 }}>
                                    {hero.heroSubtitle}
                                </Typography>
                            </Box>
                        </Stack>
                    </HeroTileButton>
                    <DismissButton
                        aria-label={`Dismiss ${hero.label}`}
                        onClick={() => handleDismiss(hero.id)}
                        size="small"
                        tone="primary">
                        <CloseIcon fontSize="small" />
                    </DismissButton>
                </Box>
            </Grid>

            { secondary.length > 0 &&
                <Grid container spacing={1.25} size={{ xs: 12, md: 7 }}>
                    { secondary.map(tile => (
                        <Grid key={tile.id} size="grow">
                            <Box sx={{ height: '100%', position: 'relative' }}>
                                <SecondaryTileButton
                                    accent={tile.accent}
                                    component={Link}
                                    href={getSchedulePath(eventSlug, tile.segment)}
                                    transitionTypes={getNavigationTransitionTypes('', tile.segment)}>
                                    <Stack spacing={1.25} sx={{
                                        alignItems: 'flex-start',
                                        height: '100%',
                                        justifyContent: 'space-between',
                                        minWidth: 0,
                                        width: '100%',
                                    }}>
                                        <SecondaryIconBadge accent={tile.accent}>
                                            {tile.icon}
                                        </SecondaryIconBadge>
                                        <Typography variant="subtitle2" noWrap
                                                    sx={{
                                                        fontWeight: 600,
                                                        lineHeight: 1.2,
                                                        maxWidth: '100%',
                                                    }}>
                                            {tile.label}
                                        </Typography>
                                    </Stack>
                                </SecondaryTileButton>
                                <DismissButton
                                    accent={tile.accent}
                                    aria-label={`Dismiss ${tile.label}`}
                                    onClick={() => handleDismiss(tile.id)}
                                    size="small"
                                    tone="secondary">
                                    <CloseIcon fontSize="small" />
                                </DismissButton>
                            </Box>
                        </Grid>
                    )) }
                </Grid> }
        </Grid>
    );
}

/**
 * Subtle corner close button overlaid on each action tile without nesting buttons inside links.
 */
const DismissButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'accent' && prop !== 'tone',
})<{ accent?: TileAccentKey; tone: 'primary' | 'secondary' }>(({ accent, theme, tone }) => {
    const palette = (theme.vars || theme).palette;
    const color = tone === 'primary'
        ? palette.m3.onPrimary
        : palette.m3[accent ?? 'tileAccentA'].text;

    return {
        color,
        opacity: 0.65,
        padding: theme.spacing(0.5),
        position: 'absolute',
        right: theme.spacing(0.75),
        top: theme.spacing(0.75),
        transition: theme.transitions.create([ 'background-color', 'opacity' ], {
            duration: theme.transitions.duration.shorter,
        }),
        zIndex: 1,

        '&:hover': {
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            opacity: 1,
        },

        variants: [
            {
                props: { tone: 'primary' },
                style: {
                    right: theme.spacing(1.25),
                    top: '50%',
                    transform: 'translateY(-50%)',
                },
            },
        ],
    };
});

/**
 * Expressive primary-gradient hero CTA button for the overview page.
 */
const HeroTileButton = styled(ButtonBase)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        background:
            `linear-gradient(135deg, ${palette.m3.primary} 0%, ` +
            `${palette.m3.primaryGradientEnd} 100%)`,
        borderRadius: kCardBorderRadiusPx,
        color: palette.m3.onPrimary,
        height: '100%',
        minHeight: 68,
        padding: theme.spacing(1.5, 5.5, 1.5, 1.75),
        textAlign: 'left',
        textDecoration: 'none',
        transition: theme.transitions.create([ 'filter', 'transform' ], {
            duration: theme.transitions.duration.shorter,
        }),
        width: '100%',

        [theme.breakpoints.up('md')]: {
            minHeight: 96,
        },

        '&:hover': {
            filter: 'brightness(0.96)',
        },
        '&:active': {
            transform: 'scale(0.99)',
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap>;

/**
 * Translucent rounded icon badge anchored on the hero tile's primary fill.
 */
const HeroIconBadge = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: `color-mix(in srgb, ${palette.m3.onPrimary} 18%, transparent)`,
        borderRadius: 10,
        color: palette.m3.onPrimary,
        display: 'flex',
        flexShrink: 0,
        height: 36,
        justifyContent: 'center',
        width: 36,
    };
});

/**
 * Compact analogous-tone secondary CTA tile with an icon badge and single-word label.
 */
const SecondaryTileButton = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent: TileAccentKey }>(({ accent, theme }) => {
    const tone = (theme.vars || theme).palette.m3[accent];

    return {
        backgroundColor: tone.background,
        borderRadius: kCardBorderRadiusPx,
        color: tone.text,
        height: '100%',
        minHeight: 78,
        padding: theme.spacing(1.5),
        textAlign: 'left',
        textDecoration: 'none',
        transition: theme.transitions.create([ 'filter', 'transform' ], {
            duration: theme.transitions.duration.shorter,
        }),
        width: '100%',

        [theme.breakpoints.up('md')]: {
            minHeight: 96,
        },

        '&:hover': {
            filter: 'brightness(0.96)',
        },
        '&:active': {
            transform: 'scale(0.98)',
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap<{ accent: TileAccentKey }>>;

/**
 * Rounded icon badge tinted with the secondary tile's analogous accent colour.
 */
const SecondaryIconBadge = styled(Box, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent: TileAccentKey }>(({ accent, theme }) => {
    const tone = (theme.vars || theme).palette.m3[accent];

    return {
        alignItems: 'center',
        backgroundColor: tone.iconBackground,
        borderRadius: 10,
        color: tone.icon,
        display: 'flex',
        flexShrink: 0,
        height: 32,
        justifyContent: 'center',
        width: 32,
    };
});
