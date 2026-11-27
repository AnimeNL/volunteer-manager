// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import type { SvgIconComponent } from '@mui/icons-material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CloseIcon from '@mui/icons-material/Close';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Grid from '@mui/material/Grid';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import IconButton from '@mui/material/IconButton';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { getNavigationTransitionTypes, getSchedulePath } from '../lib/navigationTypes';

import { kCardBorderRadiusPx } from '../Constants';

import { type DismissibleOverviewActionTileId,
    dismissOverviewActionTile } from './OverviewActions';

/**
 * Identifier of an actionable tile on the schedule overview page.
 */
export type OverviewActionTileId =
    DismissibleOverviewActionTileId | 'feedback' | 'scanner' | 'schedule';

/**
 * Accent slot key identifying which analogous palette tone a secondary tile uses.
 */
type TileAccentKey = 'tileAccentA' | 'tileAccentB' | 'tileAccentC' | 'tileAccentD';

/**
 * Static metadata describing each actionable overview tile.
 */
interface ActionTileMetadata {
    accent?: TileAccentKey;
    heroSubtitle: string;
    icon: SvgIconComponent;
    label: string;
    segment: string;
}

/**
 * Returns whether the given `tileId` can be dismissed by the volunteer.
 */
function isDismissibleTile(tileId: OverviewActionTileId): tileId is DismissibleOverviewActionTileId {
    return tileId === 'hotel' || tileId === 'ticket';
}

/**
 * Registry of overview action tile definitions indexed by tile ID. Each tile keeps a stable colour
 * identity (`accent` omitted for primary, or an analogous tone) regardless of layout slot.
 */
const kActionTiles: Record<OverviewActionTileId, ActionTileMetadata> = {
    feedback: {
        accent: 'tileAccentC',
        heroSubtitle: 'Share your thoughts',
        icon: FeedbackOutlinedIcon,
        label: 'Feedback',
        segment: '/feedback',
    },
    hotel: {
        accent: 'tileAccentA',
        heroSubtitle: 'Your hotel room',
        icon: HotelOutlinedIcon,
        label: 'Hotel',
        segment: '/hotel',
    },
    scanner: {
        accent: 'tileAccentD',
        heroSubtitle: 'Scan QR codes',
        icon: QrCodeScannerIcon,
        label: 'Scanner',
        segment: '/scanner',
    },
    schedule: {
        accent: 'tileAccentB',
        heroSubtitle: 'Your upcoming shifts',
        icon: AccessTimeIcon,
        label: 'Schedule',
        segment: '/shifts',
    },
    ticket: {
        heroSubtitle: 'Welcoming you to the festival',
        icon: ConfirmationNumberOutlinedIcon,
        label: 'Your ticket',
        segment: '/ticket',
    },
};

/**
 * Props accepted by the <OverviewActionTiles> component.
 */
interface OverviewActionTilesProps {
    /**
     * Slug of the active event used to build schedule destination URLs.
     */
    eventSlug: string;

    /**
     * Ordered list of eligible, non-dismissed action tile IDs to display.
     */
    tiles: OverviewActionTileId[];
}

/**
 * Renders the Bento grid of dismissible CTA tiles on the schedule overview page. The first visible
 * tile occupies the primary-gradient hero slot, while remaining tiles render as compact analogous
 * tonal tiles.
 */
export function OverviewActionTiles(props: OverviewActionTilesProps) {
    const { eventSlug } = props;
    const [ dismissed, setDismissed ] = useState<ReadonlySet<OverviewActionTileId>>(
        () => new Set());

    // Remount <ActionTileButton> when Next.js hides this route via <Activity mode="hidden"> so
    // in-flight MUI <TouchRipple> elements are not stranded and replayed on back navigation.
    const [ rippleKey, setRippleKey ] = useState<number>(0);
    useEffect(() => () => setRippleKey(key => key + 1), []);

    async function handleDismiss(tileId: DismissibleOverviewActionTileId) {
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

    const visibleIds = props.tiles.filter(id => !dismissed.has(id));
    if (!visibleIds.length)
        return null;

    const [ heroId, ...secondaryIds ] = visibleIds;
    const hero = kActionTiles[heroId];
    const HeroIcon = hero.icon;
    const heroDismissible = isDismissibleTile(heroId);
    const secondaryGridSize = secondaryIds.length > 3 ? { xs: 6, sm: 'grow' as const } : 'grow';

    return (
        <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: secondaryIds.length > 0 ? 5 : 12 }}>
                <Box sx={{ height: '100%', position: 'relative' }}>
                    <ActionTileButton
                        key={rippleKey}
                        accent={hero.accent}
                        component={Link}
                        dismissible={heroDismissible}
                        hero
                        href={getSchedulePath(eventSlug, hero.segment)}
                        transitionTypes={getNavigationTransitionTypes('', hero.segment)}>
                        <TileWatermark accent={hero.accent} aria-hidden className="tile-watermark"
                                       hero>
                            <HeroIcon sx={{ fontSize: 'inherit' }} />
                        </TileWatermark>
                        <Stack direction="row" spacing={1.5} sx={{
                            alignItems: 'center',
                            minWidth: 0,
                            position: 'relative',
                            width: '100%',
                            zIndex: 1,
                        }}>
                            <TileIconBadge accent={hero.accent} hero>
                                <HeroIcon fontSize="small" />
                            </TileIconBadge>
                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.5}
                                       sx={{ alignItems: 'center', minWidth: 0 }}>
                                    <Typography variant="subtitle1" noWrap
                                                sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                        {hero.label}
                                    </Typography>
                                    <TileArrow className="tile-arrow" sx={{ fontSize: 16 }} />
                                </Stack>
                                <Typography variant="caption" noWrap
                                            sx={{ display: 'block', opacity: 0.82 }}>
                                    {hero.heroSubtitle}
                                </Typography>
                            </Box>
                        </Stack>
                    </ActionTileButton>
                    { heroDismissible &&
                        <DismissButton
                            accent={hero.accent}
                            aria-label={`Dismiss ${hero.label}`}
                            hero
                            onClick={() => handleDismiss(heroId)}
                            size="small">
                            <CloseIcon fontSize="small" />
                        </DismissButton> }
                </Box>
            </Grid>

            { secondaryIds.length > 0 &&
                <Grid container spacing={1.25} size={{ xs: 12, md: 7 }}>
                    { secondaryIds.map(tileId => {
                        const tile = kActionTiles[tileId];
                        const TileIcon = tile.icon;
                        const dismissible = isDismissibleTile(tileId);
                        return (
                            <Grid key={tileId} size={secondaryGridSize}>
                                <Box sx={{ height: '100%', position: 'relative' }}>
                                    <ActionTileButton
                                        key={rippleKey}
                                        accent={tile.accent}
                                        component={Link}
                                        href={getSchedulePath(eventSlug, tile.segment)}
                                        transitionTypes={
                                            getNavigationTransitionTypes('', tile.segment)
                                        }>
                                        <TileWatermark accent={tile.accent} aria-hidden
                                                       className="tile-watermark">
                                            <TileIcon sx={{ fontSize: 'inherit' }} />
                                        </TileWatermark>
                                        <Stack spacing={1.25} sx={{
                                            alignItems: 'flex-start',
                                            height: '100%',
                                            justifyContent: 'space-between',
                                            minWidth: 0,
                                            position: 'relative',
                                            width: '100%',
                                            zIndex: 1,
                                        }}>
                                            <TileIconBadge accent={tile.accent}>
                                                <TileIcon fontSize="small" />
                                            </TileIconBadge>
                                            <Stack direction="row" spacing={0.5} sx={{
                                                alignItems: 'center',
                                                maxWidth: '100%',
                                                minWidth: 0,
                                            }}>
                                                <Typography variant="subtitle2" noWrap sx={{
                                                    fontWeight: 600,
                                                    lineHeight: 1.2,
                                                }}>
                                                    {tile.label}
                                                </Typography>
                                                <TileArrow className="tile-arrow"
                                                           sx={{ fontSize: 15 }} />
                                            </Stack>
                                        </Stack>
                                    </ActionTileButton>
                                    { dismissible &&
                                        <DismissButton
                                            accent={tile.accent}
                                            aria-label={`Dismiss ${tile.label}`}
                                            onClick={() => handleDismiss(tileId)}
                                            size="small">
                                            <CloseIcon fontSize="small" />
                                        </DismissButton> }
                                </Box>
                            </Grid>
                        );
                    }) }
                </Grid> }
        </Grid>
    );
}

/**
 * Interactive overview tile surface. Colour is determined by `accent` (primary gradient when
 * omitted, or the matching analogous tone), while `hero` controls the wider hero layout padding.
 */
const ActionTileButton = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'accent' && prop !== 'dismissible' && prop !== 'hero',
})<{ accent?: TileAccentKey; dismissible?: boolean; hero?: boolean }>(
    ({ accent, dismissible, hero, theme }) =>
{
    const palette = (theme.vars || theme).palette;
    const tone = accent ? palette.m3[accent] : undefined;

    return {
        background: tone ? tone.background : palette.m3.primary,
        borderRadius: kCardBorderRadiusPx,
        color: tone ? tone.text : palette.m3.onPrimary,
        height: '100%',
        minHeight: 80,
        overflow: 'hidden',
        padding: hero && dismissible ? theme.spacing(1.5, 5.5, 1.5, 1.5) : theme.spacing(1.5),
        position: 'relative',
        textAlign: 'left',
        textDecoration: 'none',
        width: '100%',

        '&::after': {
            backgroundColor: 'transparent',
            content: '""',
            inset: 0,
            pointerEvents: 'none',
            position: 'absolute',
            transition: theme.transitions.create('background-color', {
                duration: theme.transitions.duration.shorter,
            }),
        },

        '&:hover': {
            '&::after': {
                backgroundColor: 'rgba(0, 0, 0, 0.08)',

                ...theme.applyStyles('dark', {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                }),
            },

            '& .tile-watermark': {
                opacity: 0.2,
                transform: 'rotate(-3deg) scale(1.12)',
            },

            '& .tile-arrow': {
                opacity: 1,
                transform: 'translateX(3px)',
            },
        },

        '@media (prefers-reduced-motion: reduce)': {
            '&:hover .tile-watermark': {
                transform: 'rotate(-10deg)',
            },
            '&:hover .tile-arrow': {
                transform: 'none',
            },
        },
    };
}) as ExtendButtonBase<
    ButtonBaseTypeMap<{ accent?: TileAccentKey; dismissible?: boolean; hero?: boolean }>>;

/**
 * Oversized low-opacity icon watermark tucked into the bottom-right corner of an action tile.
 */
const TileWatermark = styled(Box, {
    shouldForwardProp: prop => prop !== 'accent' && prop !== 'hero',
})<{ accent?: TileAccentKey; hero?: boolean }>(({ accent, hero, theme }) => {
    const palette = (theme.vars || theme).palette;
    const tone = accent ? palette.m3[accent] : undefined;

    return {
        bottom: -14,
        color: tone ? tone.icon : palette.m3.onPrimary,
        display: 'flex',
        fontSize: hero ? 80 : 68,
        opacity: 0.1,
        pointerEvents: 'none',
        position: 'absolute',
        right: -10,
        transform: 'rotate(-10deg)',
        transition: theme.transitions.create([ 'opacity', 'transform' ], {
            duration: 280,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }),
    };
});

/**
 * Directional arrow affordance paired with the tile label that subtly nudges forward on hover.
 */
const TileArrow = styled(ArrowForwardIcon)(({ theme }) => ({
    flexShrink: 0,
    opacity: 0.55,
    transition: theme.transitions.create([ 'opacity', 'transform' ], {
        duration: theme.transitions.duration.shorter,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    }),
}));

/**
 * Rounded icon badge for an overview tile, sized at 36px in the hero slot and 32px in secondary
 * slots while preserving the tile's colour identity via `accent`.
 */
const TileIconBadge = styled(Box, {
    shouldForwardProp: prop => prop !== 'accent' && prop !== 'hero',
})<{ accent?: TileAccentKey; hero?: boolean }>(({ accent, hero, theme }) => {
    const palette = (theme.vars || theme).palette;
    const tone = accent ? palette.m3[accent] : undefined;
    const size = hero ? 36 : 32;

    return {
        alignItems: 'center',
        backgroundColor: tone
            ? tone.iconBackground
            : `color-mix(in srgb, ${palette.m3.onPrimary} 18%, transparent)`,
        borderRadius: 10,
        color: tone ? tone.icon : palette.m3.onPrimary,
        display: 'flex',
        flexShrink: 0,
        height: size,
        justifyContent: 'center',
        width: size,
    };
});

/**
 * Subtle close button overlaid on each action tile without nesting buttons inside links. Vertically
 * centered when `hero` is set and anchored top-right on secondary tiles.
 */
const DismissButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'accent' && prop !== 'hero',
})<{ accent?: TileAccentKey; hero?: boolean }>(({ accent, hero, theme }) => {
    const palette = (theme.vars || theme).palette;
    const color = accent ? palette.m3[accent].text : palette.m3.onPrimary;

    return {
        color,
        opacity: 0.65,
        padding: theme.spacing(0.5),
        position: 'absolute',
        right: theme.spacing(1),
        top: hero ? '50%' : theme.spacing(1),
        transform: hero ? 'translateY(-50%)' : undefined,
        transition: theme.transitions.create([ 'background-color', 'opacity' ], {
            duration: theme.transitions.duration.shorter,
        }),
        zIndex: 1,

        '&:hover': {
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            opacity: 1,
        },
    };
});
