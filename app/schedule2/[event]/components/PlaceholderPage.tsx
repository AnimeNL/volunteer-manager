// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';

import type { BooleanPermission, CRUDPermission } from '@lib/auth/access/Access';
import { EmptyStateCard } from './EmptyStateCard';
import { Header } from './Header';
import { Page, SuspenseReveal } from './Page';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Props accepted by the <PlaceholderPage> component.
 */
interface PlaceholderPageProps {
    /**
     * Optional event-scoped CRUD permission required (for `'read'`) to access this placeholder
     * page.
     */
    crudPermission?: CRUDPermission;

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
     * Title displayed in the page header and placeholder card heading. When omitted, defaults to
     * the resolved event's `shortName`.
     */
    title?: string;
}

/**
 * Authenticates the request behind `<Suspense>` and renders a simple "Not yet implemented" card.
 */
async function PlaceholderContent(
    props: Pick<PlaceholderPageProps, 'crudPermission' | 'params' | 'permission' | 'title'>)
{
    const { event: eventSlug } = await props.params;
    const { access, event } = await requireScheduleAccess(eventSlug);
    if (props.permission && !access.can(props.permission, { event: event.slug }))
        forbidden();

    if (props.crudPermission && !access.can(props.crudPermission, 'read', { event: event.slug }))
        forbidden();

    const title = props.title ?? event.shortName;

    return <EmptyStateCard description="Not yet implemented." noCard title={title} />;
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
            <Card>
                <SuspenseReveal
                    fallback={
                        <CardContent>
                            <Skeleton variant="text" width="35%" height={28} />
                            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                        </CardContent>
                    }>
                    <PlaceholderContent
                        crudPermission={props.crudPermission}
                        params={props.params}
                        permission={props.permission}
                        title={props.title} />
                </SuspenseReveal>
            </Card>
        </Page>
    );
}
