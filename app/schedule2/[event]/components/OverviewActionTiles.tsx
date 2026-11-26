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
 * Static metadata describing each actionable overview tile.
 */
interface ActionTileMetadata {
    accent: TileAccentKey;
    heroSubtitle: string;
    icon: React.ReactNode;
    label: string;
    segment: string;
}

/**
 * Registry of overview action tile definitions indexed by tile ID.
 */
const kActionTiles: Record<OverviewActionTileId, ActionTileMetadata> = {
    feedback: {
        accent: 'tileAccentC',
        heroSubtitle: 'Share your thoughts',
        icon: <FeedbackOutlinedIcon fontSize="small" />,
        label: 'Feedback',
        segment: '/feedback',
    },
    hotel: {
        accent: 'tileAccentA',
        heroSubtitle: 'Your hotel room',
        icon: <HotelOutlinedIcon fontSize="small" />,
        label: 'Hotel',
        segment: '/hotel',
    },
    schedule: {
        accent: 'tileAccentB',
        heroSubtitle: 'Your upcoming shifts',
        icon: <AccessTimeIcon fontSize="small" />,
        label: 'Schedule',
        segment: '/shifts',
    },
    ticket: {
        accent: 'tileAccentA',
        heroSubtitle: 'Your entry to the festival',
        icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
        label: 'Ticket',
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

    const visibleIds = props.tiles.filter(id => !dismissed.has(id));
    if (!visibleIds.length)
        return null;

    const [ heroId, ...secondaryIds ] = visibleIds;
    const hero = kActionTiles[heroId];

    return (
        <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: secondaryIds.length > 0 ? 5 : 12 }}>
                <Box sx={{ height: '100%', position: 'relative' }}>
                    <ActionTileButton
                        component={Link}
                        href={getSchedulePath(eventSlug, hero.segment)}
                        transitionTypes={getNavigationTransitionTypes('', hero.segment)}>
                        <Stack direction="row" spacing={1.5}
                               sx={{ alignItems: 'center', minWidth: 0, width: '100%' }}>
                            <TileIconBadge>
                                {hero.icon}
                            </TileIconBadge>
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
                    </ActionTileButton>
                    <DismissButton
                        aria-label={`Dismiss ${hero.label}`}
                        onClick={() => handleDismiss(heroId)}
                        size="small">
                        <CloseIcon fontSize="small" />
                    </DismissButton>
                </Box>
            </Grid>

            { secondaryIds.length > 0 &&
                <Grid container spacing={1.25} size={{ xs: 12, md: 7 }}>
                    { secondaryIds.map(tileId => {
                        const tile = kActionTiles[tileId];
                        return (
                            <Grid key={tileId} size="grow">
                                <Box sx={{ height: '100%', position: 'relative' }}>
                                    <ActionTileButton
                                        accent={tile.accent}
                                        component={Link}
                                        href={getSchedulePath(eventSlug, tile.segment)}
                                        transitionTypes={
                                            getNavigationTransitionTypes('', tile.segment)
                                        }>
                                        <Stack spacing={1.25} sx={{
                                            alignItems: 'flex-start',
                                            height: '100%',
                                            justifyContent: 'space-between',
                                            minWidth: 0,
                                            width: '100%',
                                        }}>
                                            <TileIconBadge accent={tile.accent}>
                                                {tile.icon}
                                            </TileIconBadge>
                                            <Typography variant="subtitle2" noWrap sx={{
                                                fontWeight: 600,
                                                lineHeight: 1.2,
                                                maxWidth: '100%',
                                            }}>
                                                {tile.label}
                                            </Typography>
                                        </Stack>
                                    </ActionTileButton>
                                    <DismissButton
                                        accent={tile.accent}
                                        aria-label={`Dismiss ${tile.label}`}
                                        onClick={() => handleDismiss(tileId)}
                                        size="small">
                                        <CloseIcon fontSize="small" />
                                    </DismissButton>
                                </Box>
                            </Grid>
                        );
                    }) }
                </Grid> }
        </Grid>
    );
}

/**
 * Interactive overview tile surface. Renders the primary-gradient hero treatment when `accent` is
 * omitted, or the corresponding analogous tonal surface when `accent` is provided.
 */
const ActionTileButton = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => {
    const palette = (theme.vars || theme).palette;
    const tone = accent ? palette.m3[accent] : undefined;

    return {
        background: tone
            ? tone.background
            : `linear-gradient(135deg, ${palette.m3.primary} 0%, ` +
              `${palette.m3.primaryGradientEnd} 100%)`,
        borderRadius: kCardBorderRadiusPx,
        color: tone ? tone.text : palette.m3.onPrimary,
        height: '100%',
        minHeight: 80,
        overflow: 'hidden',
        padding: tone ? theme.spacing(1.5) : theme.spacing(1.5, 5.5, 1.5, 1.5),
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

        '&:hover::after': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',

            ...theme.applyStyles('dark', {
                backgroundColor: 'rgba(255, 255, 255, 0.10)',
            }),
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap<{ accent?: TileAccentKey }>>;

/**
 * Rounded icon badge for an overview tile, sized at 36px for the hero tile and 32px for secondary
 * analogous tiles.
 */
const TileIconBadge = styled(Box, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => {
    const palette = (theme.vars || theme).palette;
    const tone = accent ? palette.m3[accent] : undefined;
    const size = tone ? 32 : 36;

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
 * centered on the hero tile (`accent` omitted) and anchored top-right on secondary tiles.
 */
const DismissButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => {
    const palette = (theme.vars || theme).palette;
    const color = accent ? palette.m3[accent].text : palette.m3.onPrimary;

    return {
        color,
        opacity: 0.65,
        padding: theme.spacing(0.5),
        position: 'absolute',
        right: theme.spacing(1),
        top: accent ? theme.spacing(1) : '50%',
        transform: accent ? undefined : 'translateY(-50%)',
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
