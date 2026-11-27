// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { mixColor } from '../lib/scheduleStyles';

/**
 * Gradient scrim overlaid on event banners to keep foreground titles readable.
 */
export const BannerScrim = styled(Box, {
    shouldForwardProp: prop => prop !== 'surface',
})<{ surface: 'sheet' | 'dark' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        inset: 0,
        pointerEvents: 'none',
        position: 'absolute',
        variants: [
            {
                props: { surface: 'dark' },
                style: {
                    background:
                        `linear-gradient(180deg, transparent 25%, ` +
                        `${mixColor(palette.common.black, 52)} 65%, ` +
                        `${mixColor(palette.common.black, 88)} 100%)`,
                },
            },
            {
                props: { surface: 'sheet' },
                style: {
                    background:
                        `linear-gradient(180deg, transparent 45%, ` +
                        `${mixColor(palette.m3.sheet, 55)} 76%, ` +
                        `${palette.m3.sheet} 100%)`,
                },
            },
        ],
    };
});

/**
 * Banner heading text with surface-matched colour and subtle legibility shadow.
 */
export const BannerHeading = styled(Typography, {
    shouldForwardProp: prop => prop !== 'surface',
})<{ surface: 'sheet' | 'dark' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        letterSpacing: '-0.01em',
        variants: [
            {
                props: { surface: 'dark' },
                style: {
                    color: palette.common.white,
                    textShadow:
                        `0 1px 3px ${mixColor(palette.common.black, 85)}, ` +
                        `0 0 8px ${mixColor(palette.common.black, 45)}`,
                },
            },
            {
                props: { surface: 'sheet' },
                style: {
                    color: palette.text.primary,
                    textShadow: `0 1px 6px ${palette.m3.sheet}`,
                },
            },
        ],
    };
});

/**
 * Banner subtitle text with surface-matched colour and subtle legibility shadow.
 */
export const BannerSubtitle = styled(Typography, {
    shouldForwardProp: prop => prop !== 'surface',
})<{ surface: 'sheet' | 'dark' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        variants: [
            {
                props: { surface: 'dark' },
                style: {
                    color: mixColor(palette.common.white, 82),
                    textShadow: `0 1px 3px ${mixColor(palette.common.black, 75)}`,
                },
            },
            {
                props: { surface: 'sheet' },
                style: {
                    color: palette.text.secondary,
                    textShadow: `0 1px 4px ${palette.m3.sheet}`,
                },
            },
        ],
    };
});
