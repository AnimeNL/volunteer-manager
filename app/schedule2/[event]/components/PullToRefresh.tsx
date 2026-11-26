// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';

/**
 * Damped pull distance (in pixels) required to arm and trigger a soft `router.refresh()`.
 */
const kActivationThresholdPx = 68;

/**
 * Minimum finger movement (in pixels) before locking the gesture as vertical vs horizontal.
 */
const kDirectionLockSlopPx = 8;

/**
 * Maximum visual travel distance (in pixels) for the floating refresh indicator.
 */
const kMaxPullDistancePx = 104;

/**
 * Minimum time (in milliseconds) the spinner remains visible so fast refreshes feel deliberate.
 */
const kMinRefreshDisplayMs = 450;

/**
 * Resting vertical offset (in pixels) where the indicator hovers while a refresh is in flight.
 */
const kRefreshingOffsetPx = 56;

/**
 * Returns whether any scrollable ancestor between `target` and `boundary` is already scrolled down,
 * so pulling inside a nested scroll container does not hijack its scroll gesture.
 */
function hasScrolledAncestor(target: EventTarget | null, boundary: HTMLElement): boolean {
    let current = target instanceof HTMLElement ? target : null;
    while (current && current !== boundary) {
        if (current.scrollTop > 0)
            return true;

        current = current.parentElement;
    }

    return false;
}

/**
 * Applies asymptotic rubber-band resistance to a raw downward touch delta.
 */
function computePullDistance(deltaY: number): number {
    if (deltaY <= 0)
        return 0;

    return kMaxPullDistancePx * (1 - Math.exp(-deltaY / 160));
}

/**
 * Material Design 3 pull-to-refresh gesture handler and floating circular progress indicator for
 * the mobile `<Page>` scroll sheet. Attaches to its parent scroll container and performs a soft
 * `router.refresh()` when pulled past the activation threshold at `scrollTop === 0`.
 */
export function PullToRefresh() {
    const router = useRouter();
    const routerRef = useRef(router);
    routerRef.current = router;

    const [ isPending, startTransition ] = useTransition();

    const indicatorRef = useRef<HTMLDivElement>(null);
    const [ dragging, setDragging ] = useState<boolean>(false);
    const [ minDisplayActive, setMinDisplayActive ] = useState<boolean>(false);
    const [ pullDistance, setPullDistance ] = useState<number>(0);

    const refreshing = isPending || minDisplayActive;
    const refreshingRef = useRef<boolean>(refreshing);
    refreshingRef.current = refreshing;

    useEffect(() => {
        const container = indicatorRef.current?.parentElement;
        if (!container)
            return;

        let gestureState: 'idle' | 'ignored' | 'pending' | 'pulling' = 'idle';
        let startX = 0;
        let startY = 0;
        let currentPull = 0;
        let minDisplayTimer: ReturnType<typeof setTimeout> | undefined;

        const resetGesture = () => {
            gestureState = 'idle';
            currentPull = 0;
            setDragging(false);
            setPullDistance(0);
        };

        const triggerRefresh = () => {
            if (navigator.onLine === false)
                return;

            setMinDisplayActive(true);
            clearTimeout(minDisplayTimer);
            minDisplayTimer = setTimeout(() => setMinDisplayActive(false), kMinRefreshDisplayMs);

            startTransition(() => {
                routerRef.current.refresh();
            });
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (refreshingRef.current || event.touches.length !== 1 || container.scrollTop > 0)
                return;

            const overflowY = getComputedStyle(container).overflowY;
            if (overflowY !== 'auto' && overflowY !== 'scroll')
                return;

            if (hasScrolledAncestor(event.target, container))
                return;

            const touch = event.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            currentPull = 0;
            gestureState = 'pending';
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (gestureState === 'idle' || gestureState === 'ignored' || event.touches.length !== 1)
                return;

            const touch = event.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            if (gestureState === 'pending') {
                if (Math.abs(deltaX) < kDirectionLockSlopPx &&
                    Math.abs(deltaY) < kDirectionLockSlopPx)
                {
                    return;
                }

                if (deltaY <= 0 || Math.abs(deltaX) >= deltaY) {
                    gestureState = 'ignored';
                    return;
                }

                gestureState = 'pulling';
                setDragging(true);
            }

            if (deltaY <= 0) {
                currentPull = 0;
                setPullDistance(0);
                return;
            }

            event.preventDefault();
            currentPull = computePullDistance(deltaY);
            setPullDistance(currentPull);
        };

        const handleTouchEnd = () => {
            if (gestureState !== 'pulling') {
                gestureState = 'idle';
                return;
            }

            const shouldRefresh = currentPull >= kActivationThresholdPx;
            resetGesture();

            if (shouldRefresh)
                triggerRefresh();
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        container.addEventListener('touchcancel', resetGesture, { passive: true });

        return () => {
            clearTimeout(minDisplayTimer);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', resetGesture);
        };
    }, []);

    const progress = Math.min(1, pullDistance / kActivationThresholdPx);
    const armed = progress >= 1;
    const active = refreshing || pullDistance > 0;
    const translateY = refreshing ? kRefreshingOffsetPx : pullDistance;

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
