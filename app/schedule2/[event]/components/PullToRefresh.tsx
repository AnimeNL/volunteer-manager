// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';

import { usePullToRefresh } from './usePullToRefresh';

/**
 * Material Design 3 pull-to-refresh gesture handler and floating circular progress indicator for
 * the mobile `<Page>` scroll sheet. Attaches to its parent scroll container and performs a soft
 * `router.refresh()` when pulled past the activation threshold at `scrollTop === 0`.
 */
export function PullToRefresh() {
    const {
        active,
        armed,
        dragging,
        indicatorRef,
        progress,
        refreshing,
        translateY,
    } = usePullToRefresh();

    return (
        <IndicatorHost
            aria-hidden={!active}
            dragging={dragging}
            ref={indicatorRef}
            style={{
                opacity: refreshing ? 1 : Math.min(1, progress * 1.35),
                transform: `translate(-50%, ${translateY - 44}px) scale(${active ? 1 : 0.75})`,
            }}>
            { refreshing ? (
                <CircularProgress color="primary" size={20} thickness={4.5} />
            ) : (
                <CircularProgress
                    size={20}
                    sx={{
                        color: armed ? 'primary.main' : 'text.secondary',
                        transform: `rotate(${Math.round(progress * 270 - 90)}deg)`,
                    }}
                    thickness={4.5}
                    value={Math.max(12, Math.round(progress * 88))}
                    variant="determinate" />
            ) }
        </IndicatorHost>
    );
}

/**
 * Elevated M3 Expressive circular indicator pill anchored at the top centre of the mobile sheet.
 */
const IndicatorHost = styled(Box, {
    shouldForwardProp: prop => prop !== 'dragging',
})<{ dragging: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: palette.m3.floatingNav,
        borderRadius: 9999,
        boxShadow: '0 4px 14px rgba(24, 29, 21, 0.18), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        height: 40,
        justifyContent: 'center',
        left: '50%',
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        transition: theme.transitions.create([ 'opacity', 'transform' ], {
            duration: theme.transitions.duration.short,
        }),
        width: 40,
        willChange: 'transform, opacity',
        zIndex: theme.zIndex.appBar,

        ...theme.applyStyles('dark', {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.48), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }),

        [theme.breakpoints.up('md')]: {
            display: 'none',
        },

        variants: [
            {
                props: { dragging: true },
                style: {
                    transition: 'none',
                },
            },
        ],
    };
});
