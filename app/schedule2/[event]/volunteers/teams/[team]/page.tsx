// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';

import { Header, HeaderTextSlot } from '../../../components/Header';
import { Page, SuspenseReveal } from '../../../components/Page';
import { ScheduleListSkeleton } from '../../../components/ScheduleListSkeleton';
import { VolunteerTeamRoster } from '../../VolunteerTeamRoster';
import { createScheduleMetadataFn } from '../../../lib/generateScheduleMetadata';
import { getMockVolunteerTeamDetail } from '../../../lib/data/volunteerData';
import { pluralize } from '../../../lib/format';
import { requireScheduleAccess } from '../../../lib/getScheduleAccess';

/**
 * Loads the authenticated volunteer team detail for the requested route parameters.
 */
async function loadTeamDetail(params: Promise<{ event: string; team: string }>) {
    const { event: eventSlug, team: teamSlug } = await params;
    await requireScheduleAccess(eventSlug);
    return await getMockVolunteerTeamDetail(teamSlug);
}

/**
 * Authenticates the request behind `<Suspense>` and renders the team's Backup-First roster.
 */
async function TeamRosterContent(props: { params: Promise<{ event: string; team: string }> }) {
    const { event: eventSlug, team: teamSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);

    const team = await getMockVolunteerTeamDetail(teamSlug);
    if (!team)
        notFound();

    return (
        <VolunteerTeamRoster
            eventSlug={event.slug}
            teamName={team.name}
            volunteers={team.volunteers} />
    );
}

/**
 * Team volunteer roster spoke page for the schedule portal.
 */
export default function ScheduleVolunteerTeamPage(
    props: PageProps<'/schedule2/[event]/volunteers/teams/[team]'>)
{
    return (
        <Page
            header={
                <Header
                    description={
                        <HeaderTextSlot
                            resolve={async () => {
                                const team = await loadTeamDetail(props.params);
                                if (!team)
                                    return null;

                                return `${team.activeCount} on shift · ` +
                                    pluralize(team.totalCount, 'volunteer');
                            }}
                            width={160} />
                    }
                    icon={ <GroupOutlinedIcon /> }
                    title={
                        <HeaderTextSlot
                            resolve={async () => (await loadTeamDetail(props.params))?.name ?? null}
                            width={110} />
                    } />
            }>
            <SuspenseReveal
                fallback={
                    <ScheduleListSkeleton
                        groups={[
                            {
                                leading: 'avatar',
                                rows: [ 130, 120 ],
                                subtitleWidths: [ 155, 145 ],
                                titleWidth: 72,
                            },
                            {
                                leading: 'avatar',
                                rows: [ 140, 165, 125 ],
                                subtitleWidths: [ 110, 130, 95 ],
                                titleWidth: 84,
                            },
                            {
                                leading: 'avatar',
                                rows: [ 135, 115 ],
                                subtitleWidths: [ 75, 95 ],
                                titleWidth: 80,
                            },
                        ]} />
                }>
                <TeamRosterContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Volunteers', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
