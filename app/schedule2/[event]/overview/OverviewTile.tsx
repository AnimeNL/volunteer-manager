// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ReactNode } from 'react';
import Link from '@app/LinkProxy';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import type { SvgIconComponent } from '@mui/icons-material';
import type { Theme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { useActivityRippleKey } from '../components/InteractiveSurface';

/**
 * Accent slot key identifying which analogous palette tone a supporting tile uses.
 */
export type TileAccentKey = 'tileAccentA' | 'tileAccentB' | 'tileAccentC' | 'tileAccentD';

/**
 * Resolves the tonal surface and foreground tokens for a tile from the M3 palette, falling back
 * to the primary accent when `accent` is omitted.
 */
function resolveTileTone(theme: Theme, accent?: TileAccentKey) {
    const palette = (theme.vars || theme).palette;
    if (accent)
        return palette.m3[accent];

    return {
        background: palette.m3.primary,
        icon: palette.m3.onPrimary,
        iconBackground: `color-mix(in srgb, ${palette.m3.onPrimary} 18%, transparent)`,
        text: palette.m3.onPrimary,
    };
}

/**
 * Shared props accepted by overview tile components.
 */
interface OverviewTileBaseProps {
    /**
     * Analogous M3 accent tone. Omit to render using the primary accent colour.
     */
    accent?: TileAccentKey;

    /**
     * Destination URL navigated to when the tile is activated.
     */
    href: string;

    /**
     * MUI icon component rendered in both the icon badge and the corner watermark.
     */
    icon: SvgIconComponent;

    /**
     * Primary tile heading.
     */
    label: string;

    /**
     * Optional dismissal handler; when provided, renders a top-right close button.
     */
    onDismiss?: () => void;
}

/**
 * Props accepted by the `<OverviewHeroTile>` component.
 */
interface OverviewHeroTileProps extends OverviewTileBaseProps {
    /**
     * Secondary caption displayed beneath `label`.
     */
    subtitle?: string;
}

/**
 * Props accepted by the internal `<OverviewTileFrame>` surface wrapper.
 */
interface OverviewTileFrameProps extends OverviewTileBaseProps {
    children: ReactNode;
}

/**
 * Shared interactive surface owning the tile background, corner watermark, and optional dismiss
 * button for both hero and supporting action tiles.
 */
function OverviewTileFrame(props: OverviewTileFrameProps) {
    const { accent, children, href, icon: Icon, label, onDismiss } = props;
    const rippleKey = useActivityRippleKey();

    return (
        <Box sx={{ height: '100%', position: 'relative' }}>
            <TileSurface key={rippleKey} accent={accent} component={Link} href={href}>
                <TileWatermark aria-hidden accent={accent}>
                    <Icon sx={{ fontSize: 'inherit' }} />
                </TileWatermark>
                {children}
            </TileSurface>
            { onDismiss &&
                <DismissButton
                    accent={accent}
                    aria-label={`Dismiss ${label}`}
                    onClick={onDismiss}
                    size="small">
                    <CloseIcon fontSize="small" />
                </DismissButton> }
        </Box>
    );
}

/**
 * Horizontal hero tile rendered inside `<OverviewTiles>` with an optional subtitle.
 */
export function OverviewHeroTile(props: OverviewHeroTileProps) {
    const { accent, icon: Icon, label, onDismiss, subtitle, ...frameProps } = props;

    return (
        <OverviewTileFrame
            {...frameProps}
            accent={accent}
            icon={Icon}
            label={label}
            onDismiss={onDismiss}>
            <Stack direction="row" spacing={1.5} sx={{
                alignItems: 'center',
                height: '100%',
                minWidth: 0,
                position: 'relative',
                width: '100%',
                zIndex: 1,
            }}>
                <TileBadge accent={accent}>
                    <Icon fontSize="small" />
                </TileBadge>
                <Box sx={{ maxWidth: '100%', minWidth: 0, pr: onDismiss ? 4 : 0 }}>
                    <Stack direction="row" spacing={0.5}
                           sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2 }}>
                            {label}
                        </Typography>
                        <TileArrow fontSize="inherit" />
                    </Stack>
                    { subtitle &&
                        <Typography variant="caption" noWrap
                                    sx={{ display: 'block', opacity: 0.82 }}>
                            {subtitle}
                        </Typography> }
                </Box>
            </Stack>
        </OverviewTileFrame>
    );
}

/**
 * Compact vertical supporting action tile rendered inside `<OverviewTiles>`.
 */
export function OverviewActionTile(props: OverviewTileBaseProps) {
    const { accent, icon: Icon, label, ...frameProps } = props;

    return (
        <OverviewTileFrame {...frameProps} accent={accent} icon={Icon} label={label}>
            <Stack spacing={1.25} sx={{
                alignItems: 'flex-start',
                height: '100%',
                justifyContent: 'space-between',
                minWidth: 0,
                position: 'relative',
                width: '100%',
                zIndex: 1,
            }}>
                <TileBadge accent={accent}>
                    <Icon fontSize="small" />
                </TileBadge>
                <Box sx={{ maxWidth: '100%', minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5}
                           sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap sx={{ lineHeight: 1.2 }}>
                            {label}
                        </Typography>
                        <TileArrow fontSize="inherit" />
                    </Stack>
                </Box>
            </Stack>
        </OverviewTileFrame>
    );
}

/**
 * Top-right dismiss icon button inheriting the tile's tonal foreground colour.
 */
const DismissButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => ({
    color: resolveTileTone(theme, accent).text,
    opacity: 0.65,
    padding: theme.spacing(0.5),
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    zIndex: 1,

    '&:hover': {
        backgroundColor: (theme.vars || theme).palette.action.hover,
        opacity: 1,
    },
}));

/**
 * Tonal squircle icon badge inside an overview tile.
 */
const TileBadge = styled(Box, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => {
    const tone = resolveTileTone(theme, accent);

    return {
        alignItems: 'center',
        backgroundColor: tone.iconBackground,
        borderRadius: 10,
        color: tone.icon,
        display: 'flex',
        flexShrink: 0,
        height: theme.spacing(4),
        justifyContent: 'center',
        width: theme.spacing(4),
    };
});

/**
 * Decorative corner watermark icon animated via CSS variables controlled by `<TileSurface>`.
 */
const TileWatermark = styled(Box, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => ({
    bottom: -14,
    color: resolveTileTone(theme, accent).icon,
    display: 'flex',
    fontSize: '4.5rem',
    opacity: 'var(--tile-watermark-opacity, 0.1)',
    pointerEvents: 'none',
    position: 'absolute',
    right: -10,
    transform: 'var(--tile-watermark-transform, rotate(-10deg))',
    transition: theme.transitions.create([ 'opacity', 'transform' ], {
        duration: theme.transitions.duration.standard,
        easing: theme.transitions.easing.easeOut,
    }),
}));

/**
 * Trailing directional arrow icon animated via CSS variables controlled by `<TileSurface>`.
 */
const TileArrow = styled(ArrowForwardIcon)(({ theme }) => ({
    flexShrink: 0,
    opacity: 'var(--tile-arrow-opacity, 0.55)',
    transform: 'var(--tile-arrow-transform, none)',
    transition: theme.transitions.create([ 'opacity', 'transform' ], {
        duration: theme.transitions.duration.shorter,
        easing: theme.transitions.easing.easeOut,
    }),
}));

/**
 * Interactive flat tonal tile surface owning the hover tint and CSS variable transitions.
 */
const TileSurface = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'accent',
})<{ accent?: TileAccentKey }>(({ accent, theme }) => {
    const palette = (theme.vars || theme).palette;
    const tone = resolveTileTone(theme, accent);

    return {
        backgroundColor: tone.background,
        borderRadius: theme.shape.borderRadius,
        color: tone.text,
        height: '100%',
        minHeight: 80,
        overflow: 'hidden',
        padding: theme.spacing(1.5),
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
            '--tile-arrow-opacity': 1,
            '--tile-arrow-transform': 'translateX(3px)',
            '--tile-watermark-opacity': 0.2,
            '--tile-watermark-transform': 'rotate(-3deg) scale(1.12)',

            '&::after': {
                backgroundColor: palette.action.hover,
            },
        },

        '@media (prefers-reduced-motion: reduce)': {
            '&:hover': {
                '--tile-arrow-transform': 'none',
                '--tile-watermark-transform': 'rotate(-10deg)',
            },
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap<{ accent?: TileAccentKey }>>;
