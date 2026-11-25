// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense, ViewTransition } from 'react';
import { forbidden } from 'next/navigation';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import type { BooleanPermission } from '@lib/auth/access/Access';
import { Header } from './Header';
import { Page } from './Page';
import { SetTitle } from './ScheduleTitle';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Props accepted by the <PlaceholderPage> component.
 */
interface PlaceholderPageProps {
    /**
     * Optional single-line description shown beneath the header title.
     */
    description?: string;

    /**
     * Optional leading icon displayed in the page `<Header>` badge. When both `icon` and `title`
     * are provided, a `<Header>` is rendered above the page content.
     */
    icon?: React.ReactNode;

    /**
     * Route params promise containing the `event` slug, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;

    /**
     * Optional event-scoped permission required to access this placeholder page.
     */
    permission?: BooleanPermission;

    /**
     * Title displayed in the AppBar, page header, and placeholder card heading. When omitted,
     * defaults to the resolved event's `shortName`.
     */
    title?: string;
}

/**
 * Authenticates the request behind `<Suspense>` and renders a simple "Not yet implemented" card.
 */
async function PlaceholderContent(
    props: Pick<PlaceholderPageProps, 'params' | 'permission' | 'title'>)
{
    const { event: eventSlug } = await props.params;
    const { access, event } = await requireScheduleAccess(eventSlug);
    if (props.permission && !access.can(props.permission, { event: event.slug }))
        forbidden();

    const title = props.title ?? event.shortName;

    return (
        <>
            { !props.title && <SetTitle title={title} /> }
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Not yet implemented.
                    </Typography>
                </CardContent>
            </Card>
        </>
    );
}

/**
 * Generic "Not yet implemented" page shared by unbuilt schedule routes.
 */
export function PlaceholderPage(props: PlaceholderPageProps) {
    const header = props.icon && props.title ? (
        <Header description={props.description} icon={props.icon} title={props.title} />
    ) : undefined;

    return (
        <Page header={header}>
            { props.title && <SetTitle title={props.title} /> }
            <Suspense
                fallback={
                    <ViewTransition exit="schedule-slide-down" default="none">
                        <Card>
                            <CardContent>
                                <Skeleton variant="text" width="35%" height={28} />
                                <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                            </CardContent>
                        </Card>
                    </ViewTransition>
                }>
                <ViewTransition enter="schedule-slide-up" default="none">
                    <PlaceholderContent params={props.params} permission={props.permission}
                                        title={props.title} />
                </ViewTransition>
            </Suspense>
        </Page>
    );
}
