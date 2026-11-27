// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense, ViewTransition } from 'react';

import Stack from '@mui/material/Stack';

import { PageScrollReset } from './PageScrollReset';
import { PullToRefresh } from './PullToRefresh';

import { kSheetBorderRadiusPx } from '../Constants';

/**
 * Props accepted by the <Page> component.
 */
interface PageProps {
    /**
     * Optional banner rendered flush at the top of the mobile sheet without outer padding.
     */
    banner?: React.ReactNode;

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
    const hasBanner = Boolean(props.banner);

    return (
        <ViewTransition enter="schedule-page-enter" exit="schedule-page-exit" default="none">
            {props.header}
            <Stack useFlexGap sx={{
                bgcolor: { xs: 'm3.sheet', md: 'transparent' },
                borderRadius: {
                    xs: `${kSheetBorderRadiusPx}px ${kSheetBorderRadiusPx}px 0 0`,
                    md: 0,
                },
                flex: '1 1 auto',
                minHeight: { xs: 0, md: 'auto' },
                minWidth: 0,
                overflowY: { xs: 'auto', md: 'visible' },
                overscrollBehaviorY: { xs: 'contain', md: 'auto' },
                position: { xs: 'relative', md: 'static' },
                ...(hasBanner
                    ? { gap: { xs: 1.5, md: 0 }, p: 0 }
                    : {
                        gap: 1.5,
                        p: { xs: 1.5, md: 0 },
                        pb: {
                            xs: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                            md: 0,
                        },
                    }),
            }}>
                <PullToRefresh />
                <Suspense fallback={null}>
                    <PageScrollReset />
                </Suspense>
                { hasBanner ? (
                    <>
                        {props.banner}
                        <Stack spacing={1.5} useFlexGap sx={{
                            pb: {
                                xs: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                                md: 0,
                            },
                            px: { xs: 1.5, md: 0 },
                        }}>
                            {props.children}
                        </Stack>
                    </>
                ) : props.children }
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
