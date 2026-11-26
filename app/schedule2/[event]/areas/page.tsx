// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Skeleton from '@mui/material/Skeleton';

import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { ScheduleList, ScheduleListRow } from '../components/ScheduleList';
import { getSchedulePath } from '../lib/navigationTypes';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

import { kMockProgramAreas } from '../lib/data/mockProgramData';

/**
 * Authenticates the request behind `<Suspense>` and renders the segmented list of program areas.
 */
async function AreasListContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);

    return (
        <ScheduleList variant="segmented">
            { kMockProgramAreas.map(area =>
                <ScheduleListRow
                    key={area.id}
                    chevron
                    href={getSchedulePath(event.slug, `/areas/${area.id}`)}
                    subtitle={area.locationsSummary}
                    title={area.name}
                    trailing={`${area.locationsCount} locations`}
                    transitionTypes={[ 'nav-forward' ]} /> ) }
        </ScheduleList>
    );
}

/**
 * Skeleton placeholder mirroring the segmented `<ScheduleList>` while areas are streaming.
 */
function AreasListSkeleton() {
    const rows = [
        { subtitleWidth: 210, titleWidth: 96 },
        { subtitleWidth: 175, titleWidth: 112 },
        { subtitleWidth: 155, titleWidth: 120 },
        { subtitleWidth: 190, titleWidth: 88 },
    ];

    return (
        <ScheduleList variant="segmented">
            { rows.map(({ subtitleWidth, titleWidth }, index) =>
                <ScheduleListRow
                    key={index}
                    subtitle={ <Skeleton variant="text" width={subtitleWidth} /> }
                    title={ <Skeleton variant="text" width={titleWidth} /> }
                    trailing={ <Skeleton variant="text" width={64} /> } /> ) }
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
            <SuspenseReveal fallback={ <AreasListSkeleton /> }>
                <AreasListContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
