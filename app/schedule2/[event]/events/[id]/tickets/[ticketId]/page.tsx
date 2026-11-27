// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cache } from 'react';
import { forbidden, notFound } from 'next/navigation';

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { EmptyStateCard } from '../../../../components/EmptyStateCard';
import { Header } from '../../../../components/Header';
import { Page, SuspenseReveal } from '../../../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../../../components/ScheduleListSkeleton';
import { SectionHeader } from '../../../../components/SectionHeader';
import { getEventTicketHolders } from '../../../../lib/data/ticketData';
import { requireScheduleAccess } from '../../../../lib/getScheduleAccess';
import db, { tActivities } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Request-cached loader fetching the program event title for `activityParam` in `festivalId`.
 */
const loadEventSummary = cache(async (festivalId: number | undefined, activityParam: string) => {
    const activityId = Number(activityParam);
    if (!festivalId || !Number.isInteger(activityId))
        return undefined;

    const title = await db.selectFrom(tActivities)
        .where(tActivities.activityFestivalId.equals(festivalId))
            .and(tActivities.activityType.equals(kActivityType.Program))
            .and(tActivities.activityDeleted.isNull())
            .and(tActivities.activityId.equals(activityId))
        .selectOneColumn(tActivities.activityTitle)
        .executeSelectNoneOrOne();

    return title ? { activityId, title } : undefined;
});

/**
 * Resolves access, permission, event summary, and ticket holders for the current route params.
 */
async function resolveEventTicketHolders(
    params: Promise<{ event: string; id: string; ticketId: string }>)
{
    const { event: eventSlug, id, ticketId: ticketIdParam } = await params;
    const { access, event } = await requireScheduleAccess(eventSlug);
    if (!access.can('event.tickets', 'read', { event: event.slug }))
        forbidden();

    const eventTicketId = Number(ticketIdParam);
    if (!Number.isInteger(eventTicketId))
        return undefined;

    const activity = await loadEventSummary(event.integrations?.anPlanFestivalId, id);
    if (!activity)
        return undefined;

    const ticketHolders = await getEventTicketHolders(
        event, activity.activityId, activity.title, eventTicketId);
    if (!ticketHolders)
        return undefined;

    return {
        ...ticketHolders,
        eventTitle: activity.title,
    };
}

/**
 * Streams the program event title into the page `<Header>`.
 */
async function EventTicketsTitle(
    props: { params: Promise<{ event: string; id: string; ticketId: string }> })
{
    const data = await resolveEventTicketHolders(props.params);
    return data?.eventTitle ?? null;
}

/**
 * Streams the product name and ticket count into the page `<Header>` description.
 */
async function EventTicketsDescription(
    props: { params: Promise<{ event: string; id: string; ticketId: string }> })
{
    const data = await resolveEventTicketHolders(props.params);
    if (!data)
        return null;

    const count = data.holders.length;
    const label = count === 1 ? 'ticket' : 'tickets';
    return `${data.productName} · ${count} ${label}`;
}

/**
 * Authenticates the request behind `<Suspense>` and renders the flat list of ticket holders.
 */
async function EventTicketsContent(
    props: { params: Promise<{ event: string; id: string; ticketId: string }> })
{
    const data = await resolveEventTicketHolders(props.params);
    if (!data)
        notFound();

    if (!data.holders.length) {
        return (
            <EmptyStateCard
                description={`No active tickets have been issued for ${data.productName} yet.`} />
        );
    }

    return (
        <Stack spacing={0.75} useFlexGap>
            <SectionHeader title="Ticket holders" />
            <ScheduleList>
                { data.holders.map(holder =>
                    <ScheduleListRow
                        key={holder.id}
                        title={holder.name}
                        trailing={holder.orderNumber} /> ) }
            </ScheduleList>
        </Stack>
    );
}

/**
 * Ticket holders page for a specific program event ticket product.
 */
export default function ScheduleEventTicketsPage(
    props: PageProps<'/schedule2/[event]/events/[id]/tickets/[ticketId]'>)
{
    return (
        <Page
            header={
                <Header
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={160} /> }>
                            <EventTicketsDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={ <ConfirmationNumberOutlinedIcon /> }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={180} /> }>
                            <EventTicketsTitle params={props.params} />
                        </SuspenseReveal>
                    } />
            }>
            <SuspenseReveal
                fallback={
                    <ScheduleListSkeleton
                        groups={[
                            {
                                rows: [ 155, 130, 170, 145, 160 ],
                                titleWidth: 96,
                                trailingWidth: 64,
                            },
                        ]} />
                }>
                <EventTicketsContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
