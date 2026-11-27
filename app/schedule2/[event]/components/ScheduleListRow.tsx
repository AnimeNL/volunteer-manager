// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { styled } from '@mui/material/styles';

import { RestrictedBadge } from './RestrictedBadge';
import { useActivityRippleKey } from './InteractiveSurface';

/**
 * Display state of a `<ScheduleListRow>`, controlling surface tint, typography emphasis, and
 * finished strikethrough treatment.
 */
type ScheduleListRowState = 'active' | 'default' | 'past';

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
     * Colour role for `<LinearProgress>` when `progress` is set. Defaults to `'primary'`.
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

    const rippleKey = useActivityRippleKey();

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
                    <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Typography
                            color={state === 'active'
                                ? undefined
                                : (isPast ? 'textDisabled' : 'textPrimary')}
                            noWrap
                            sx={{
                                color: state === 'active' ? 'secondary.contrastText' : undefined,
                                fontWeight: state === 'active' ? 600 : undefined,
                                lineHeight: subtitle ? 1.25 : 1.35,
                                textDecoration: isPast ? 'line-through' : undefined,
                            }}
                            variant={subtitle ? 'subtitle2' : 'body2'}>
                            {title}
                        </Typography>
                        { hidden &&
                            <RestrictedBadge
                                icon={ <VisibilityOffOutlinedIcon fontSize="inherit" /> }
                                muted={isPast}
                                title="Hidden from visitors" /> }
                    </Stack>
                    { !!subtitle &&
                        <Typography variant="body2" color="textSecondary" noWrap
                                    sx={{ lineHeight: 1.35 }}>
                            {subtitle}
                        </Typography> }
                </Box>
                { (!!trailing || chevron) &&
                    <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: 'center', flexShrink: 0 }}>
                        { !!trailing &&
                            <Typography
                                color={state === 'active'
                                    ? 'primary'
                                    : (isPast ? 'textDisabled' : 'textSecondary')}
                                sx={{
                                    fontVariantNumeric: 'tabular-nums',
                                    fontWeight: state === 'active' ? 600 : undefined,
                                    lineHeight: 1.35,
                                    textDecoration: isPast ? 'line-through' : undefined,
                                    whiteSpace: 'nowrap',
                                }}
                                variant="caption">
                                {trailing}
                            </Typography> }
                        { chevron &&
                            <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} /> }
                    </Stack> }
            </Stack>
            { clampedProgress !== undefined &&
                <LinearProgress
                    color={progressColor}
                    sx={{
                        bgcolor:
                            'color-mix(in srgb, var(--mui-palette-text-primary) 10%, transparent)',
                        height: 2,
                        mt: 0.75,
                    }}
                    value={clampedProgress}
                    variant="determinate" /> }
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
                isHidden={hidden}
                rowState={state}>
                {inner}
            </RowButton>
        );
    }

    return (
        <RowStatic data-state={state} hasSubtitle={!!subtitle} isHidden={hidden} rowState={state}>
            {inner}
        </RowStatic>
    );
}

/**
 * Styling props forwarded to `<RowButton>` and `<RowStatic>`.
 */
interface RowSurfaceProps {
    hasSubtitle: boolean;
    isHidden: boolean;
    rowState: ScheduleListRowState;
}

/**
 * Filter preventing internal row styling props from reaching the underlying DOM element.
 */
const isRowSurfaceProp = (prop: PropertyKey) =>
    prop !== 'hasSubtitle' && prop !== 'isHidden' && prop !== 'rowState';

/**
 * Builds a subtle 45-degree repeating hatch background image using the given CSS colour expression.
 */
function debossedHatch(color: string): string {
    return (
        `repeating-linear-gradient(-45deg, ${color}, ${color} 4px, ` +
        'transparent 4px, transparent 12px)'
    );
}

/**
 * Shared row surface styling for both interactive (`<RowButton>`) and static (`<RowStatic>`) rows.
 */
function rowSurfaceStyles(theme: Theme) {
    const palette = (theme.vars || theme).palette;

    const lightStripe = `color-mix(in srgb, ${palette.text.primary} 3.2%, transparent)`;
    const darkStripe = `color-mix(in srgb, ${palette.common.black} 7.5%, transparent)`;
    const lightPastStripe = `color-mix(in srgb, ${palette.text.primary} 2%, transparent)`;
    const darkPastStripe = `color-mix(in srgb, ${palette.common.black} 4.5%, transparent)`;

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
                        `color-mix(in srgb, ${palette.secondary.main} 65%, ` +
                        `${palette.background.paper})`,
                },
            },
            {
                props: { rowState: 'past' as ScheduleListRowState },
                style: {
                    backgroundColor:
                        `color-mix(in srgb, ${palette.text.primary} 2.5%, ${palette.m3.sheet})`,
                },
            },
            {
                props: { isHidden: true },
                style: {
                    backgroundImage: debossedHatch(lightStripe),
                    ...theme.applyStyles('dark', {
                        backgroundImage: debossedHatch(darkStripe),
                    }),
                },
            },
            {
                props: { isHidden: true, rowState: 'past' as ScheduleListRowState },
                style: {
                    backgroundImage: debossedHatch(lightPastStripe),
                    ...theme.applyStyles('dark', {
                        backgroundImage: debossedHatch(darkPastStripe),
                    }),
                },
            },
        ],
    };
}

/**
 * Interactive row button rendered when `href` is provided.
 */
const RowButton = styled(ButtonBase, {
    shouldForwardProp: isRowSurfaceProp,
})<RowSurfaceProps>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        ...rowSurfaceStyles(theme),
        transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shorter,
        }),

        '&:hover': {
            backgroundColor: palette.action.hover,
        },

        '&[data-state="active"]:hover': {
            backgroundColor:
                `color-mix(in srgb, ${palette.secondary.main} 80%, ${palette.background.paper})`,
        },

        '&[data-state="past"]:hover': {
            backgroundColor:
                `color-mix(in srgb, ${palette.text.primary} 6%, ${palette.m3.sheet})`,
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap<RowSurfaceProps>>;

/**
 * Non-interactive row container matching `<RowButton>` geometry and state surface.
 */
const RowStatic = styled(Box, {
    shouldForwardProp: isRowSurfaceProp,
})<RowSurfaceProps>(({ theme }) => rowSurfaceStyles(theme));
