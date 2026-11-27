// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { styled } from '@mui/material/styles';

import { kCardBorderRadiusPx } from '../Constants';

/**
 * Display state of a `<ScheduleListRow>`, controlling surface tint, typography emphasis, and
 * finished strikethrough treatment.
 */
export type ScheduleListRowState = 'active' | 'default' | 'past';

/**
 * Props accepted by the <ScheduleList> component.
 */
interface ScheduleListProps {
    /**
     * Whether to render a recessed, muted container for past or finished groups (applies to the
     * `'conjoined'` variant).
     */
    muted?: boolean;

    /**
     * Layout presentation: `'conjoined'` (default) groups rows inside a single rounded card with
     * hairline dividers, while `'segmented'` stacks individual rounded tiles with a 3px gap.
     */
    variant?: 'conjoined' | 'segmented';
}

/**
 * Shared dense list container for the schedule portal. Supports conjoined cards for grouped events
 * and M3 Expressive segmented stacks for top-level entity indexes.
 */
export function ScheduleList(props: React.PropsWithChildren<ScheduleListProps>) {
    const { children, muted = false, variant = 'conjoined' } = props;

    if (variant === 'segmented')
        return <SegmentedListRoot>{children}</SegmentedListRoot>;

    return (
        <ConjoinedListRoot muted={muted}>
            {children}
        </ConjoinedListRoot>
    );
}

/**
 * Props accepted by the <ScheduleListRow> component.
 */
interface ScheduleListRowProps {
    /**
     * Whether to display a trailing navigation chevron beside the right-aligned metadata.
     */
    chevron?: boolean;

    /**
     * Whether the item is hidden from visitors, displaying a slashed-eye indicator.
     */
    hidden?: boolean;

    /**
     * Optional destination URL making the row an interactive Next.js link.
     */
    href?: string;

    /**
     * Optional completion percentage (`0` to `100`) rendered as a subtle 2px progress track
     * beneath non-past rows.
     */
    progress?: number;

    /**
     * Colour role for `<ProgressTrack>` when `progress` is set. Defaults to `'primary'`.
     */
    progressColor?: 'error' | 'primary' | 'success' | 'warning';

    /**
     * Visual state of the row: `'default'`, `'active'` (live), or `'past'` (finished).
     */
    state?: ScheduleListRowState;

    /**
     * Optional muted second line rendered beneath the title (e.g. locations summary on Areas).
     */
    subtitle?: React.ReactNode;

    /**
     * Primary single-line label for the row.
     */
    title: React.ReactNode;

    /**
     * Optional compact right-aligned metadata (e.g. tabular time range or location count).
     */
    trailing?: React.ReactNode;
}

/**
 * Dense, reusable schedule row supporting active live highlights with hairline progress tracks,
 * finished strikethrough states, hidden-item indicators, and optional link navigation.
 */
export function ScheduleListRow(props: ScheduleListRowProps) {
    const {
        chevron = false,
        hidden = false,
        href,
        progress,
        progressColor = 'primary',
        state = 'default',
        subtitle,
        title,
        trailing,
    } = props;

    // Remount <RowButton> when Next.js hides this route via <Activity mode="hidden"> so in-flight
    // MUI <TouchRipple> elements are not stranded and replayed on back navigation.
    const [ rippleKey, setRippleKey ] = useState<number>(0);
    useEffect(() => () => setRippleKey(key => key + 1), []);

    const isPast = state === 'past';
    const clampedProgress =
        !isPast && typeof progress === 'number'
            ? Math.min(100, Math.max(0, progress))
            : undefined;

    const inner = (
        <Box sx={{ minWidth: 0, width: '100%' }}>
            <Stack direction="row" spacing={1.5} sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: 0,
            }}>
                <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <RowTitle
                            hasSubtitle={!!subtitle}
                            state={state}
                            variant={subtitle ? 'subtitle2' : 'body2'}
                            noWrap>
                            {title}
                        </RowTitle>
                        { hidden &&
                            <Tooltip title="Hidden from visitors">
                                <HiddenIconBadge
                                    aria-label="Hidden from visitors"
                                    muted={isPast}>
                                    <VisibilityOffOutlinedIcon fontSize="inherit" />
                                </HiddenIconBadge>
                            </Tooltip> }
                    </Stack>
                    { !!subtitle &&
                        <Typography variant="body2" color="textSecondary" noWrap
                                    sx={{ lineHeight: 1.35 }}>
                            {subtitle}
                        </Typography> }
                </Box>
                { (!!trailing || chevron) &&
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                        { !!trailing &&
                            <RowTrailing state={state} variant="caption">
                                {trailing}
                            </RowTrailing> }
                        { chevron &&
                            <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} /> }
                    </Stack> }
            </Stack>
            { clampedProgress !== undefined &&
                <ProgressTrack>
                    <ProgressFill color={progressColor} style={{ width: `${clampedProgress}%` }} />
                </ProgressTrack> }
        </Box>
    );

    if (href) {
        return (
            <RowButton
                key={rippleKey}
                component={Link}
                data-state={state}
                hasSubtitle={!!subtitle}
                href={href}
                rowState={state}>
                {inner}
            </RowButton>
        );
    }

    return (
        <RowStatic data-state={state} hasSubtitle={!!subtitle} rowState={state}>
            {inner}
        </RowStatic>
    );
}

/**
 * Conjoined rounded card container with state-aware hairline dividers between child rows.
 */
const ConjoinedListRoot = styled(Box, {
    shouldForwardProp: prop => prop !== 'muted',
})<{ muted: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.m3.card,
        borderRadius: kCardBorderRadiusPx,
        overflow: 'hidden',

        '& > :not(:first-of-type)': {
            borderTop: `1px solid color-mix(in srgb, ${palette.divider} 65%, transparent)`,
        },

        '& > [data-state="active"] + [data-state="active"]': {
            borderTop:
                `1px solid color-mix(in srgb, ${palette.m3.onSecondaryContainer} 12%, transparent)`,
        },

        '& > :not([data-state="active"]) + [data-state="active"]': {
            borderTop: 'none',
        },

        variants: [
            {
                props: { muted: true },
                style: {
                    backgroundColor: 'rgba(0, 0, 0, 0.025)',
                    border: `1px solid ${palette.divider}`,
                    ...theme.applyStyles('dark', {
                        backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    }),
                },
            },
        ],
    };
});

/**
 * M3 Expressive segmented stack applying 12px outer corners and 4px inner corners to child rows.
 */
const SegmentedListRoot = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,

        '& > [data-state]': {
            backgroundColor: palette.m3.card,
            borderRadius: 4,
            overflow: 'hidden',
        },

        '& > [data-state]:first-of-type': {
            borderTopLeftRadius: kCardBorderRadiusPx,
            borderTopRightRadius: kCardBorderRadiusPx,
        },

        '& > [data-state]:last-of-type': {
            borderBottomLeftRadius: kCardBorderRadiusPx,
            borderBottomRightRadius: kCardBorderRadiusPx,
        },

        '& > a[data-state="default"]:hover': {
            backgroundColor: `color-mix(in srgb, ${palette.m3.card} 94%, ${palette.text.primary})`,
        },
    };
});

/**
 * Shared row surface styling for both interactive (`<RowButton>`) and static (`<RowStatic>`) rows.
 */
function rowSurfaceStyles(theme: Theme) {
    const palette = (theme.vars || theme).palette;

    return {
        display: 'flex',
        padding: theme.spacing(1.125, 1.75),
        textAlign: 'left' as const,
        textDecoration: 'none',
        width: '100%',
        variants: [
            {
                props: { hasSubtitle: true },
                style: {
                    padding: theme.spacing(1.25, 2),
                },
            },
            {
                props: { rowState: 'active' as ScheduleListRowState },
                style: {
                    backgroundColor:
                        `color-mix(in srgb, ${palette.m3.secondaryContainer} 65%, ` +
                        `${palette.m3.card})`,
                },
            },
        ],
    };
}

/**
 * Interactive row button rendered when `href` is provided.
 */
const RowButton = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'hasSubtitle' && prop !== 'rowState',
})<{ hasSubtitle: boolean; rowState: ScheduleListRowState }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        ...rowSurfaceStyles(theme),
        transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shorter,
        }),

        '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            ...theme.applyStyles('dark', {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }),
        },

        '&[data-state="active"]:hover': {
            backgroundColor:
                `color-mix(in srgb, ${palette.m3.secondaryContainer} 80%, ${palette.m3.card})`,
        },
    };
}) as ExtendButtonBase<
    ButtonBaseTypeMap<{ hasSubtitle: boolean; rowState: ScheduleListRowState }>>;

/**
 * Non-interactive row container matching `<RowButton>` geometry and state surface.
 */
const RowStatic = styled(Box, {
    shouldForwardProp: prop => prop !== 'hasSubtitle' && prop !== 'rowState',
})<{ hasSubtitle: boolean; rowState: ScheduleListRowState }>(
    ({ theme }) => rowSurfaceStyles(theme));

/**
 * Primary row title text styled by row state.
 */
const RowTitle = styled(Typography, {
    shouldForwardProp: prop => prop !== 'hasSubtitle' && prop !== 'state',
})<{ hasSubtitle: boolean; state: ScheduleListRowState }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        color: palette.text.primary,
        lineHeight: 1.35,
        variants: [
            {
                props: { hasSubtitle: true },
                style: {
                    fontWeight: 600,
                    lineHeight: 1.25,
                },
            },
            {
                props: { state: 'active' },
                style: {
                    color: palette.m3.onSecondaryContainer,
                    fontWeight: 600,
                },
            },
            {
                props: { state: 'past' },
                style: {
                    color: palette.text.disabled,
                    textDecoration: 'line-through',
                },
            },
        ],
    };
});

/**
 * Compact right-aligned tabular metadata text (dates, times, or counts).
 */
const RowTrailing = styled(Typography, {
    shouldForwardProp: prop => prop !== 'state',
})<{ state: ScheduleListRowState }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        color: palette.text.secondary,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
        variants: [
            {
                props: { state: 'active' },
                style: {
                    color: palette.m3.primary,
                    fontWeight: 600,
                },
            },
            {
                props: { state: 'past' },
                style: {
                    color: palette.text.disabled,
                    textDecoration: 'line-through',
                },
            },
        ],
    };
});

/**
 * Warm-amber slashed-eye indicator denoting events hidden from visitors.
 */
const HiddenIconBadge = styled('span', {
    shouldForwardProp: prop => prop !== 'muted',
})<{ muted: boolean }>(({ theme }) => ({
    alignItems: 'center',
    color: '#8c5a12',
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: theme.typography.caption.fontSize,
    opacity: 0.92,
    ...theme.applyStyles('dark', {
        color: '#d9b87c',
    }),
    variants: [
        {
            props: { muted: true },
            style: {
                opacity: 0.55,
            },
        },
    ],
}));

/**
 * Subtle 2px progress track tucked beneath active rows.
 */
const ProgressTrack = styled(Box)(({ theme }) => ({
    backgroundColor: 'rgba(0, 0, 0, 0.09)',
    borderRadius: 999,
    height: 2,
    marginTop: theme.spacing(0.75),
    overflow: 'hidden',
    width: '100%',
    ...theme.applyStyles('dark', {
        backgroundColor: 'rgba(255, 255, 255, 0.11)',
    }),
}));

/**
 * Filled portion of `<ProgressTrack>` coloured with the configured semantic accent.
 */
const ProgressFill = styled(Box, {
    shouldForwardProp: prop => prop !== 'color',
})<{ color: 'error' | 'primary' | 'success' | 'warning' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.m3.primary,
        borderRadius: 999,
        height: '100%',
        variants: [
            {
                props: { color: 'error' },
                style: { backgroundColor: palette.error.main },
            },
            {
                props: { color: 'success' },
                style: { backgroundColor: palette.success.main },
            },
            {
                props: { color: 'warning' },
                style: { backgroundColor: palette.warning.main },
            },
        ],
    };
});
