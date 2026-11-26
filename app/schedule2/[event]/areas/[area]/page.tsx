// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../components/ScheduleList';
import { SectionHeader } from '../../components/SectionHeader';
import { getMockAreaDetail } from '../../lib/data/mockProgramData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Streams the resolved area title into the page `<Header>`.
 */
async function AreaTitle(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    await requireScheduleAccess(eventSlug);

    return getMockAreaDetail(area).name;
}

/**
 * Streams the resolved area description into the page `<Header>`.
 */
async function AreaDescription(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    await requireScheduleAccess(eventSlug);

    return getMockAreaDetail(area).description;
}

/**
 * Authenticates the request behind `<Suspense>` and renders each location's conjoined event list.
 */
async function AreaLocationsContent(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const areaDetail = getMockAreaDetail(area);

    return (
        <Stack spacing={2} useFlexGap>
            { areaDetail.locations.map(location =>
                <Stack key={location.id} spacing={0.75} useFlexGap>
                    <SectionHeader
                        actionLabel="Schedule"
                        href={getSchedulePath(event.slug, `/locations/${location.id}`)}
                        title={location.name}
                        transitionTypes={[ 'nav-forward' ]} />
                    <ScheduleList>
                        { location.events.map(programEvent =>
                            <ScheduleListRow
                                key={programEvent.id}
                                hidden={programEvent.hidden}
                                href={getSchedulePath(event.slug, `/events/${programEvent.id}`)}
                                progress={programEvent.progress}
                                state={programEvent.state}
                                title={programEvent.title}
                                trailing={programEvent.time}
                                transitionTypes={[ 'nav-forward' ]} /> ) }
                    </ScheduleList>
                </Stack> ) }
        </Stack>
    );
}

/**
 * Skeleton placeholder mirroring the location groups while area data is streaming.
 */
function AreaLocationsSkeleton() {
    const groups = [
        { rows: [ 150, 140 ], titleWidth: 84 },
        { rows: [ 130, 125 ], titleWidth: 112 },
        { rows: [ 180, 145, 220 ], titleWidth: 76 },
    ];

    return (
        <Stack spacing={2} useFlexGap>
            { groups.map((group, groupIndex) =>
                <Stack key={groupIndex} spacing={0.75} useFlexGap>
                    <SectionHeader title={ <Skeleton variant="text" width={group.titleWidth} /> } />
                    <ScheduleList>
                        { group.rows.map((rowWidth, rowIndex) =>
                            <ScheduleListRow
                                key={rowIndex}
                                title={ <Skeleton variant="text" width={rowWidth} /> }
                                trailing={ <Skeleton variant="text" width={72} /> } /> ) }
                    </ScheduleList>
                </Stack> ) }
        </Stack>
    );
}

/**
 * Area detail page listing each location in the area and its active and upcoming program events.
 */
export default function ScheduleAreaPage(props: PageProps<'/schedule2/[event]/areas/[area]'>) {
    return (
        <Page
            header={
                <Header
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={140} /> }>
                            <AreaDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={ <EventNoteOutlinedIcon /> }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={120} /> }>
                            <AreaTitle params={props.params} />
                        </SuspenseReveal>
                    } />
            }>
            <SuspenseReveal fallback={ <AreaLocationsSkeleton /> }>
                <AreaLocationsContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
