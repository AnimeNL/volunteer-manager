// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { getNavigationTransitionTypes, getSchedulePath } from '../lib/navigationTypes';

import { kCardBorderRadiusPx } from '../Constants';

/**
 * Props accepted by the <OverviewActionTiles> component.
 */
interface OverviewActionTilesProps {
    /**
     * Slug of the active event used to build schedule destination URLs.
     */
    eventSlug: string;

    /**
     * Whether the signed-in volunteer has an assigned festival ticket for this event.
     */
    hasTicket: boolean;
}

/**
 * Renders the actionable CTA tiles on the schedule overview page.
 */
export function OverviewActionTiles(props: OverviewActionTilesProps) {
    const { eventSlug, hasTicket } = props;
    if (!hasTicket)
        return null;

    return (
        <HeroTileButton
            component={Link}
            href={getSchedulePath(eventSlug, '/ticket')}
            transitionTypes={getNavigationTransitionTypes('', '/ticket')}>
            <HeroContent>
                <HeroIconBadge>
                    <ConfirmationNumberOutlinedIcon fontSize="small" />
                </HeroIconBadge>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        Ticket
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
                        Your entry to the festival
                    </Typography>
                </Box>
            </HeroContent>
            <HeroArrowBadge>
                <ArrowForwardIcon fontSize="small" />
            </HeroArrowBadge>
        </HeroTileButton>
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
        justifyContent: 'space-between',
        minHeight: 68,
        padding: theme.spacing(1.5, 1.75),
        textAlign: 'left',
        textDecoration: 'none',
        transition: theme.transitions.create([ 'filter', 'transform' ], {
            duration: theme.transitions.duration.shorter,
        }),
        width: '100%',

        '&:hover': {
            filter: 'brightness(0.96)',
        },
        '&:active': {
            transform: 'scale(0.99)',
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap>;

/**
 * Leading icon badge and label group inside the hero tile.
 */
const HeroContent = styled(Box)(({ theme }) => ({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1.5),
    minWidth: 0,
}));

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
