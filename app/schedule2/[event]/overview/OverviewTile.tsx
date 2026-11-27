// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

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
                <Box aria-hidden className="tile-watermark">
                    <Icon sx={{ fontSize: 'inherit' }} />
                </Box>
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
    const { icon: Icon, label, onDismiss, subtitle, ...frameProps } = props;

    return (
        <OverviewTileFrame {...frameProps} icon={Icon} label={label} onDismiss={onDismiss}>
            <Stack direction="row" spacing={1.5} sx={{
                alignItems: 'center',
                height: '100%',
                minWidth: 0,
                position: 'relative',
                width: '100%',
                zIndex: 1,
            }}>
                <Box className="tile-badge">
                    <Icon fontSize="small" />
                </Box>
                <Box sx={{ maxWidth: '100%', minWidth: 0, pr: onDismiss ? 4 : 0 }}>
                    <Stack direction="row" spacing={0.5}
                           sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2 }}>
                            {label}
                        </Typography>
                        <ArrowForwardIcon className="tile-arrow" fontSize="inherit" />
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
    const { icon: Icon, label, ...frameProps } = props;

    return (
        <OverviewTileFrame {...frameProps} icon={Icon} label={label}>
            <Stack spacing={1.25} sx={{
                alignItems: 'flex-start',
                height: '100%',
                justifyContent: 'space-between',
                minWidth: 0,
                position: 'relative',
                width: '100%',
                zIndex: 1,
            }}>
                <Box className="tile-badge">
                    <Icon fontSize="small" />
                </Box>
                <Box sx={{ maxWidth: '100%', minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5}
                           sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap sx={{ lineHeight: 1.2 }}>
                            {label}
                        </Typography>
                        <ArrowForwardIcon className="tile-arrow" fontSize="inherit" />
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
 * Interactive flat tonal tile surface owning the hover tint, icon badge, watermark, and arrow
 * transitions so all tonal tokens are resolved once.
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

        '& .tile-badge': {
            alignItems: 'center',
            backgroundColor: tone.iconBackground,
            borderRadius: 10,
            color: tone.icon,
            display: 'flex',
            flexShrink: 0,
            height: theme.spacing(4),
            justifyContent: 'center',
            width: theme.spacing(4),
        },

        '& .tile-watermark': {
            bottom: -14,
            color: tone.icon,
            display: 'flex',
            fontSize: '4.5rem',
            opacity: 0.1,
            pointerEvents: 'none',
            position: 'absolute',
            right: -10,
            transform: 'rotate(-10deg)',
            transition: theme.transitions.create([ 'opacity', 'transform' ], {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.easeOut,
            }),
        },

        '& .tile-arrow': {
            flexShrink: 0,
            opacity: 0.55,
            transition: theme.transitions.create([ 'opacity', 'transform' ], {
                duration: theme.transitions.duration.shorter,
                easing: theme.transitions.easing.easeOut,
            }),
        },

        '&:hover': {
            '&::after': {
                backgroundColor: palette.action.hover,
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
}) as ExtendButtonBase<ButtonBaseTypeMap<{ accent?: TileAccentKey }>>;
