// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

import { kSheetBorderRadiusPx, kShellSpacingPx } from '../Constants';

/**
 * Primary rounded content sheet for `app/schedule2/`. On mobile (M2-A), runs edge-to-edge with
 * top-only `18px` corners and bottom clearance for the floating navigation pill. On desktop
 * (C3-C), sits as an all-around `18px`-rounded sheet with a uniform `12px` internal rhythm.
 */
export const ScheduleContentSheet = styled(Stack)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.m3.sheet,
        borderTopLeftRadius: kSheetBorderRadiusPx,
        borderTopRightRadius: kSheetBorderRadiusPx,
        flex: '1 1 auto',
        gap: kShellSpacingPx,
        minWidth: 0,
        padding: kShellSpacingPx,
        paddingBottom: `calc(80px + env(safe-area-inset-bottom, 0px))`,

        [theme.breakpoints.up('md')]: {
            borderRadius: kSheetBorderRadiusPx,
            paddingBottom: kShellSpacingPx,
        },
    };
});
