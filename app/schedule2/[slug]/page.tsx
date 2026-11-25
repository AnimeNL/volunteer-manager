// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense, ViewTransition } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

/**
 * Opt into Next.js Instant Navigation validation and Partial Prefetching for `app/schedule2/`.
 */
export const instant = true;
export const prefetch = 'partial';

/**
 * Fallback skeleton displayed in the static shell while dynamic event overview data streams in.
 */
function OverviewPlaceholderSkeleton() {
    return (
        <Card>
            <CardContent>
                <Skeleton variant="text" width="35%" height={20} />
                <Skeleton variant="text" width="60%" height={32} />
                <Skeleton variant="text" width="80%" height={20} />
            </CardContent>
        </Card>
    );
}

/**
 * Async Server Component that consumes the dynamic `[slug]` route parameter inside `<Suspense>` so
 * the surrounding App Shell stays static and reusable across slugs.
 */
async function OverviewPlaceholder(props: Pick<PageProps<'/schedule2/[slug]'>, 'params'>) {
    const { slug } = await props.params;

    return (
        <Card>
            <CardContent>
                <Typography sx={{ color: 'text.secondary', fontSize: 14 }} gutterBottom>
                    Volunteer Portal (Mocked)
                </Typography>
                <Typography variant="h5">
                    Event: {slug}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Placeholder landing page rendered via React Server Components, streaming{' '}
                    &lt;Suspense&gt;, and View Transitions.
                </Typography>
            </CardContent>
        </Card>
    );
}

/**
 * Minimal mocked landing page for `app/schedule2/[slug]/`. Wraps the page in directional
 * `<ViewTransition>` boundaries and streams slug-dependent content behind `<Suspense>`.
 */
export default function Schedule2LandingPage(props: PageProps<'/schedule2/[slug]'>) {
    return (
        <ViewTransition
            enter={{
                'nav-forward': 'schedule2-nav-forward',
                'nav-back': 'schedule2-nav-back',
                default: 'none',
            }}
            exit={{
                'nav-forward': 'schedule2-nav-forward',
                'nav-back': 'schedule2-nav-back',
                default: 'none',
            }}
            default="none">
            <Suspense
                fallback={
                    <ViewTransition exit="schedule2-slide-down" default="none">
                        <OverviewPlaceholderSkeleton />
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule2-slide-up" default="none">
                    <OverviewPlaceholder params={props.params} />
                </ViewTransition>
            </Suspense>
        </ViewTransition>
    );
}
