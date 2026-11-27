// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import StarIcon from '@mui/icons-material/Star';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { styled } from '@mui/material/styles';

import { RestrictedBadge } from './RestrictedBadge';
import { cardHoverSurface, mixColor, mutedRowSurface } from '../lib/scheduleStyles';
import { useActivityRippleKey } from './InteractiveSurface';
import { useScheduleListVariant } from './ScheduleList';

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
     * Whether the item has been favourited by the volunteer, displaying a star icon beside the
     * trailing metadata.
     */
    favourite?: boolean;

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
     * Whether the item represents a ticketed event, displaying a ticket icon beside the trailing
     * metadata.
     */
    ticketed?: boolean;

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
        favourite = false,
        hidden = false,
        href,
        progress,
        progressColor = 'primary',
        state = 'default',
        subtitle,
        ticketed = false,
        title,
        trailing,
    } = props;

    const rippleKey = useActivityRippleKey();
    const segmented = useScheduleListVariant() === 'segmented';

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
                { (favourite || ticketed || !!trailing || chevron) &&
                    <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: 'center', flexShrink: 0 }}>
                        { favourite &&
                            <Tooltip title="Favourited event">
                                <Box
                                    component="span"
                                    aria-label="Favourited event"
                                    sx={{
                                        alignItems: 'center',
                                        color: isPast ? 'text.disabled' : 'primary.main',
                                        display: 'inline-flex',
                                        flexShrink: 0,
                                        typography: 'body2',
                                    }}>
                                    <StarIcon fontSize="inherit" />
                                </Box>
                            </Tooltip> }
                        { ticketed &&
                            <Tooltip title="Ticketed event">
                                <Box
                                    component="span"
                                    aria-label="Ticketed event"
                                    sx={{
                                        alignItems: 'center',
                                        color: state === 'active'
                                            ? 'primary.main'
                                            : (isPast ? 'text.disabled' : 'text.secondary'),
                                        display: 'inline-flex',
                                        flexShrink: 0,
                                        opacity: state === 'default' ? 0.85 : 1,
                                        typography: 'body2',
                                    }}>
                                    <ConfirmationNumberOutlinedIcon fontSize="inherit" />
                                </Box>
                            </Tooltip> }
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
                <RowProgress
                    color={progressColor}
                    value={clampedProgress}
                    variant="determinate" /> }
        </Box>
    );

    if (href) {
        return (
            <RowButton
                key={rippleKey}
                component={Link}
                data-active={state === 'active' || undefined}
                hasSubtitle={!!subtitle}
                href={href}
                isHidden={hidden}
                rowState={state}
                segmented={segmented}>
                {inner}
            </RowButton>
        );
    }

    return (
        <RowStatic
            data-active={state === 'active' || undefined}
            hasSubtitle={!!subtitle}
            isHidden={hidden}
            rowState={state}>
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
    segmented?: boolean;
}

/**
 * Filter preventing internal row styling props from reaching the underlying DOM element.
 */
const isRowSurfaceProp = (prop: PropertyKey) =>
    prop !== 'hasSubtitle' && prop !== 'isHidden' && prop !== 'rowState' && prop !== 'segmented';

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

    const lightStripe = mixColor(palette.text.primary, 3.2);
    const darkStripe = mixColor(palette.common.black, 7.5);
    const lightPastStripe = mixColor(palette.text.primary, 2);
    const darkPastStripe = mixColor(palette.common.black, 4.5);

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
                    backgroundColor: mixColor(palette.secondary.main, 65, palette.background.paper),
                },
            },
            {
                props: { rowState: 'past' as ScheduleListRowState },
                style: {
                    backgroundColor: mutedRowSurface(theme),
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

        variants: [
            {
                props: { rowState: 'default', segmented: true },
                style: {
                    '&:hover': {
                        backgroundColor: cardHoverSurface(theme),
                    },
                },
            },
            {
                props: { rowState: 'active' },
                style: {
                    '&:hover': {
                        backgroundColor:
                            mixColor(palette.secondary.main, 80, palette.background.paper),
                    },
                },
            },
            {
                props: { rowState: 'past' },
                style: {
                    '&:hover': {
                        backgroundColor: mixColor(palette.text.primary, 8, palette.m3.sheet),
                    },
                },
            },
        ],
    };
}) as ExtendButtonBase<ButtonBaseTypeMap<RowSurfaceProps>>;

/**
 * Hairline progress track displayed beneath active or bounded schedule rows.
 */
const RowProgress = styled(LinearProgress)(({ theme }) => ({
    backgroundColor: mixColor((theme.vars || theme).palette.text.primary, 10),
    height: 2,
    marginTop: theme.spacing(0.75),
}));

/**
 * Non-interactive row container matching `<RowButton>` geometry and state surface.
 */
const RowStatic = styled(Box, {
    shouldForwardProp: isRowSurfaceProp,
})<RowSurfaceProps>(({ theme }) => rowSurfaceStyles(theme));
