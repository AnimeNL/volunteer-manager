// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';

import { EmptyStateCard } from '../../../../components/EmptyStateCard';
import { Header, HeaderTextSlot } from '../../../../components/Header';
import { Page, SuspenseReveal } from '../../../../components/Page';
import { ScheduleListRow } from '../../../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../../../components/ScheduleListSkeleton';
import { ScheduleSection } from '../../../../components/ScheduleSection';
import { createScheduleMetadataFn } from '../../../../lib/generateScheduleMetadata';
import { getEventTicketHolders } from '../../../../lib/data/ticketData';
import { getProgramEventSummary } from '../../../../lib/data/programData';
import { pluralize } from '../../../../lib/format';
import { requireScheduleAccess } from '../../../../lib/getScheduleAccess';

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

    const activity = await getProgramEventSummary(event.integrations?.anPlanFestivalId, id);
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
        <ScheduleSection title="Ticket holders">
            { data.holders.map(holder =>
                <ScheduleListRow
                    key={holder.id}
                    title={holder.name}
                    trailing={holder.orderNumber} /> ) }
        </ScheduleSection>
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
                        <HeaderTextSlot
                            resolve={async () => {
                                const data = await resolveEventTicketHolders(props.params);
                                return data
                                    ? `${data.productName} · ` +
                                      `${pluralize(data.holders.length, 'ticket')}`
                                    : null;
                            }}
                            width={160} />
                    }
                    icon={ <ConfirmationNumberOutlinedIcon /> }
                    title={
                        <HeaderTextSlot
                            resolve={async () =>
                                (await resolveEventTicketHolders(props.params))?.eventTitle ??
                                null}
                            width={180} />
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

export const generateMetadata =
    createScheduleMetadataFn('Tickets', { activity: 'id' }, 'Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
