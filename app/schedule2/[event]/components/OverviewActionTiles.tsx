// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Grid from '@mui/material/Grid';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { getNavigationTransitionTypes, getSchedulePath } from '../lib/navigationTypes';

import { kCardBorderRadiusPx } from '../Constants';

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
    id: 'ticket' | 'hotel' | 'schedule' | 'feedback';
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
     * Whether the signed-in volunteer has a confirmed hotel room booking for this event.
     */
    hasHotelRoom: boolean;

    /**
     * Whether the signed-in user has a personal shift or favourite schedule for this event.
     */
    hasSchedule: boolean;

    /**
     * Whether the signed-in volunteer has an assigned festival ticket for this event.
     */
    hasTicket: boolean;
}

/**
 * Renders the Bento grid of actionable CTA tiles on the schedule overview page. The first visible
 * tile occupies the primary-gradient hero slot, while remaining tiles render as compact analogous
 * tonal tiles.
 */
export function OverviewActionTiles(props: OverviewActionTilesProps) {
    const { eventSlug, hasHotelRoom, hasSchedule, hasTicket } = props;

    const tiles: ActionTileDefinition[] = [];
    if (hasTicket) {
        tiles.push({
            accent: 'tileAccentA',
            heroSubtitle: 'Your entry to the festival',
            icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
            id: 'ticket',
            label: 'Ticket',
            segment: '/ticket',
        });
    }

    if (hasHotelRoom) {
        tiles.push({
            accent: 'tileAccentA',
            heroSubtitle: 'Your hotel room',
            icon: <HotelOutlinedIcon fontSize="small" />,
            id: 'hotel',
            label: 'Hotel',
            segment: '/hotel',
        });
    }

    if (hasSchedule) {
        tiles.push({
            accent: 'tileAccentB',
            heroSubtitle: 'Your upcoming shifts',
            icon: <AccessTimeIcon fontSize="small" />,
            id: 'schedule',
            label: 'Schedule',
            segment: '/shifts',
        });
    }

    tiles.push({
        accent: 'tileAccentC',
        heroSubtitle: 'Share your thoughts',
        icon: <FeedbackOutlinedIcon fontSize="small" />,
        id: 'feedback',
        label: 'Feedback',
        segment: '/feedback',
    });

    const [ hero, ...secondary ] = tiles;

    return (
        <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: secondary.length > 0 ? 5 : 12 }}>
                <HeroTileButton
                    component={Link}
                    href={getSchedulePath(eventSlug, hero.segment)}
                    transitionTypes={getNavigationTransitionTypes('', hero.segment)}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
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
                    <HeroArrowBadge>
                        <ArrowForwardIcon fontSize="small" />
                    </HeroArrowBadge>
                </HeroTileButton>
            </Grid>

            { secondary.length > 0 &&
                <Grid container spacing={1.25} size={{ xs: 12, md: 7 }}>
                    { secondary.map(tile => (
                        <Grid key={tile.id} size="grow">
                            <SecondaryTileButton
                                accent={tile.accent}
                                component={Link}
                                href={getSchedulePath(eventSlug, tile.segment)}
                                transitionTypes={getNavigationTransitionTypes('', tile.segment)}>
                                <SecondaryIconBadge accent={tile.accent}>
                                    {tile.icon}
                                </SecondaryIconBadge>
                                <Typography variant="subtitle2" noWrap
                                            sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                    {tile.label}
                                </Typography>
                            </SecondaryTileButton>
                        </Grid>
                    )) }
                </Grid> }
        </Grid>
    );
}

/**
 * Expressive primary-gradient hero CTA button for the overview page.
 */
const HeroTileButton = styled(ButtonBase)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        background:
            `linear-gradient(135deg, ${palette.m3.primary} 0%, ` +
            `${palette.m3.primaryGradientEnd} 100%)`,
        borderRadius: kCardBorderRadiusPx,
        color: palette.m3.onPrimary,
        display: 'flex',
        gap: theme.spacing(1.5),
        height: '100%',
        justifyContent: 'space-between',
        minHeight: 68,
        padding: theme.spacing(1.5, 1.75),
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
 * Trailing circular arrow indicator on the hero tile.
 */
const HeroArrowBadge = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: `color-mix(in srgb, ${palette.m3.onPrimary} 20%, transparent)`,
        borderRadius: 9999,
        color: palette.m3.onPrimary,
        display: 'inline-flex',
        flexShrink: 0,
        height: 30,
        justifyContent: 'center',
        width: 30,
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
        alignItems: 'flex-start',
        backgroundColor: tone.background,
        borderRadius: kCardBorderRadiusPx,
        color: tone.text,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1.25),
        height: '100%',
        justifyContent: 'space-between',
        minHeight: 78,
        minWidth: 0,
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
