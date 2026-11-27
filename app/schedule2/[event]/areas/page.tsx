// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';

import { EmptyStateCard } from '../components/EmptyStateCard';
import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { ScheduleList, ScheduleListRow } from '../components/ScheduleList';
import { SegmentedListSkeleton } from '../components/ScheduleListSkeleton';
import { getProgramAreasWithLocations } from '../lib/data/programData';
import { getSchedulePath } from '../lib/navigationTypes';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>` and renders the segmented list of program areas.
 */
async function AreasListContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const festivalId = event.integrations?.anPlanFestivalId;

    const areas = festivalId ? await getProgramAreasWithLocations(festivalId) : [];
    if (!areas.length) {
        return (
            <EmptyStateCard
                description={`No program areas have been announced for ${event.shortName} yet.`} />
        );
    }

    return (
        <ScheduleList variant="segmented">
            { areas.map(area => {
                const { locations } = area;
                const subtitle = locations.length > 2
                    ? `${locations.slice(0, 2).join(', ')}, and ${locations.length - 2} more`
                    : locations.join(', ');

                return (
                    <ScheduleListRow
                        key={area.id}
                        chevron
                        href={getSchedulePath(event.slug, `/areas/${area.id}`)}
                        subtitle={subtitle}
                        title={area.name} />
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

export const instant = true;
export const prefetch = 'partial';
