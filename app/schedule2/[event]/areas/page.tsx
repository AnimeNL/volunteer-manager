// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';

import { EmptyStateCard } from '../components/EmptyStateCard';
import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { PillBadge } from '../components/PillBadge';
import { ScheduleList, ScheduleListRow } from '../components/ScheduleList';
import { SegmentedListSkeleton } from '../components/ScheduleListSkeleton';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';
import { getEventState } from '@lib/event';
import { getSchedulePath } from '../lib/navigationTypes';
import { pluralize } from '../lib/format';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>` and renders the segmented list of program areas.
 */
async function AreasListContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { currentTime, event } = await requireScheduleAccess(eventSlug);

    const eventState = await getEventState(event);
    const areas = eventState?.program.getAreas({ programOnly: true }) ?? [];
    if (!eventState || !areas.length) {
        return (
            <EmptyStateCard
                description={`No program areas have been announced for ${event.shortName} yet.`} />
        );
    }

    const snapshot = eventState.at(currentTime);

    return (
        <ScheduleList variant="segmented">
            { areas.map(area => {
                const locations = eventState.program
                    .getLocations(area.id, { programOnly: true })
                    .map(location => location.name);
                const subtitle = locations.length > 2
                    ? `${locations.slice(0, 2).join(', ')} and ${locations.length - 2} more…`
                    : locations.join(', ');

                const activeCount = snapshot.activeTimeslots({
                    areaId: area.id,
                    programOnly: true,
                }).length;

                const activeLabel = pluralize(activeCount, 'active event');

                return (
                    <ScheduleListRow
                        key={area.id}
                        chevron
                        href={getSchedulePath(event.slug, `/areas/${area.id}`)}
                        subtitle={subtitle}
                        title={area.name}
                        trailing={activeCount > 0 ? (
                            <PillBadge label={activeCount} title={activeLabel} />
                        ) : undefined} />
                );
            }) }
        </ScheduleList>
    );
}

/**
 * Program areas index page for the schedule portal.
 */
export default function ScheduleAreasPage(props: PageProps<'/schedule2/[event]/areas'>) {
    return (
        <Page
            header={
                <Header
                    description="Browse festival areas and scheduled program events."
                    icon={ <EventNoteOutlinedIcon /> }
                    title="Events" />
            }>
            <SuspenseReveal
                fallback={
                    <SegmentedListSkeleton
                        chevron
                        rows={[
                            { subtitleWidth: 210, titleWidth: 96 },
                            { subtitleWidth: 175, titleWidth: 112 },
                            { subtitleWidth: 155, titleWidth: 120 },
                            { subtitleWidth: 190, titleWidth: 88 },
                        ]} />
                }>
                <AreasListContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
