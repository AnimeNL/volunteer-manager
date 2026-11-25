// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense, ViewTransition } from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { PageTransition } from './PageTransition';
import { SetTitle } from './ScheduleTitle';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Props accepted by the <PlaceholderPage> component.
 */
interface PlaceholderPageProps {
    /**
     * Route params promise containing the `event` slug, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;

    /**
     * Title displayed in the AppBar and placeholder card heading. When omitted, defaults to the
     * resolved event's `shortName`.
     */
    title?: string;
}

/**
 * Authenticates the request behind `<Suspense>` and renders a simple "Not yet implemented" card.
 */
async function PlaceholderContent(props: PlaceholderPageProps) {
    const { event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const title = props.title ?? event.shortName;

    return (
        <>
            { !props.title && <SetTitle title={title} /> }
            <Card>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Not yet implemented.
                    </Typography>
                </CardContent>
            </Card>
        </>
    );
}

/**
 * Generic "Not yet implemented" page shared by unbuilt `app/schedule2/` routes.
 */
export function PlaceholderPage(props: PlaceholderPageProps) {
    return (
        <PageTransition>
            { props.title && <SetTitle title={props.title} /> }
            <Suspense
                fallback={
                    <ViewTransition exit="schedule2-slide-down" default="none">
                        <Card>
                            <CardContent>
                                <Skeleton variant="text" width="35%" height={28} />
                                <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                            </CardContent>
                        </Card>
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule2-slide-up" default="none">
                    <PlaceholderContent params={props.params} title={props.title} />
                </ViewTransition>
            </Suspense>
        </PageTransition>
    );
}
