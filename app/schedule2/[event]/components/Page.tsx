// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense, ViewTransition } from 'react';

import Stack from '@mui/material/Stack';

import { kSheetBorderRadiusPx } from '../Constants';

/**
 * Props accepted by the <Page> component.
 */
interface PageProps {
    /**
     * Optional page header rendered in the outer shell above the rounded sheet on mobile, and as
     * the leading element inside the sheet on desktop.
     */
    header?: React.ReactNode;
}

/**
 * Standard page container for the schedule portal. Wraps route transitions and places the mobile
 * `m3.sheet` surface beneath the optional `<Header>` while keeping desktop content unified inside
 * the layout's outer sheet.
 */
export function Page(props: React.PropsWithChildren<PageProps>) {
    return (
        <ViewTransition
            enter={{
                'nav-forward': 'schedule-nav-forward',
                'nav-back': 'schedule-nav-back',
                default: 'none',
            }}
            exit={{
                'nav-forward': 'schedule-nav-forward',
                'nav-back': 'schedule-nav-back',
                default: 'none',
            }}
            default="none">
            {props.header}
            <Stack spacing={1.5} useFlexGap sx={{
                bgcolor: { xs: 'm3.sheet', md: 'transparent' },
                borderRadius: {
                    xs: `${kSheetBorderRadiusPx}px ${kSheetBorderRadiusPx}px 0 0`,
                    md: 0,
                },
                flex: '1 1 auto',
                minWidth: 0,
                p: { xs: 1.5, md: 0 },
                pb: {
                    xs: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                    md: 0,
                },
            }}>
                {props.children}
            </Stack>
        </ViewTransition>
    );
}

/**
 * Props accepted by the <SuspenseReveal> component.
 */
interface SuspenseRevealProps {
    /**
     * Skeleton fallback displayed while the child subtree is streaming.
     */
    fallback: React.ReactNode;
}

/**
 * Wraps async content in a `<Suspense>` boundary paired with smooth slide-down/slide-up
 * `<ViewTransition>` reveals between the skeleton fallback and resolved content.
 */
export function SuspenseReveal(props: React.PropsWithChildren<SuspenseRevealProps>) {
    return (
        <Suspense
            fallback={
                <ViewTransition exit="schedule-slide-down" default="none">
                    {props.fallback}
                </ViewTransition>
            }>
            <ViewTransition enter="schedule-slide-up" default="none">
                {props.children}
            </ViewTransition>
        </Suspense>
    );
}
