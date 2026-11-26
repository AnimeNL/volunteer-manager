// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Fragment } from 'react';

import Divider from '@mui/material/Divider';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../components/ScheduleList';
import { SectionHeader } from '../../components/SectionHeader';
import { getMockLocationDetail } from '../../lib/data/mockProgramData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Streams the resolved location title into the page `<Header>`.
 */
async function LocationTitle(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    await requireScheduleAccess(eventSlug);

    return getMockLocationDetail(id).name;
}

/**
 * Streams the parent area name into the page `<Header>` description.
 */
async function LocationDescription(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    await requireScheduleAccess(eventSlug);

    return getMockLocationDetail(id).areaName;
}

/**
 * Authenticates the request behind `<Suspense>` and renders day-grouped events for the location.
 */
async function LocationScheduleContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const locationDetail = getMockLocationDetail(id);

    let showedPastDivider = false;

    return (
        <Stack spacing={2} useFlexGap>
            { locationDetail.days.map(day => {
                const renderDivider = day.isPast && !showedPastDivider;
                if (renderDivider)
                    showedPastDivider = true;

                return (
                    <Fragment key={day.label}>
                        { renderDivider && <Divider /> }
                        <Stack spacing={0.75} useFlexGap>
                            <SectionHeader
                                muted={day.isPast}
                                title={day.label} />
                            <ScheduleList muted={day.isPast}>
                                { day.events.map(programEvent =>
                                    <ScheduleListRow
                                        key={programEvent.id}
                                        hidden={programEvent.hidden}
                                        href={getSchedulePath(
                                            event.slug, `/events/${programEvent.id}`)}
                                        progress={programEvent.progress}
                                        state={programEvent.state}
                                        title={programEvent.title}
                                        trailing={programEvent.time}
                                        transitionTypes={[ 'nav-forward' ]} /> ) }
                            </ScheduleList>
                        </Stack>
                    </Fragment>
                );
            }) }
        </Stack>
    );
}

/**
 * Skeleton placeholder mirroring day-grouped events while location data is streaming.
 */
function LocationScheduleSkeleton() {
    const groups = [
        { rows: [ 210, 175, 195 ], titleWidth: 72 },
        { rows: [ 205, 165 ], titleWidth: 64 },
    ];

    return (
        <Stack spacing={2} useFlexGap>
            { groups.map((group, groupIndex) =>
                <Stack key={groupIndex} spacing={0.75} useFlexGap>
                    <SectionHeader
                        title={ <Skeleton variant="text" width={group.titleWidth} /> } />
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
 * Location detail page listing scheduled program events grouped by festival day.
 */
export default function ScheduleLocationPage(
    props: PageProps<'/schedule2/[event]/locations/[id]'>)
{
    return (
        <Page
            header={
                <Header
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={96} /> }>
                            <LocationDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={ <PlaceOutlinedIcon /> }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={136} /> }>
                            <LocationTitle params={props.params} />
                        </SuspenseReveal>
                    } />
            }>
            <SuspenseReveal fallback={ <LocationScheduleSkeleton /> }>
                <LocationScheduleContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
