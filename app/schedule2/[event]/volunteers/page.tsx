// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import Stack from '@mui/material/Stack';

import type { VolunteerTeamSummary } from '../lib/data/volunteerData';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { PillBadge } from '../components/PillBadge';
import { ScheduleList, ScheduleListRow } from '../components/ScheduleList';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedListSkeleton } from '../components/ScheduleListSkeleton';
import { VolunteerTeamRoster } from './VolunteerTeamRoster';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';
import { getMockVolunteerTeamDetail, getMockVolunteerTeams } from '../lib/data/volunteerData';
import { getSchedulePath } from '../lib/navigationTypes';
import { pluralize } from '../lib/format';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Formats a concise active-volunteer summary subtitle for a team hub row.
 */
function formatTeamSubtitle(team: VolunteerTeamSummary): string {
    const { activeCount, activeFirstNames, totalCount } = team;
    if (activeCount === 0)
        return pluralize(totalCount, 'volunteer');

    if (activeCount === 1)
        return `${activeFirstNames[0]} on shift`;

    if (activeCount === 2)
        return `${activeFirstNames[0]} and ${activeFirstNames[1]} on shift`;

    return `${activeFirstNames[0]}, ${activeFirstNames[1]} and ${activeCount - 2} more on shift`;
}

/**
 * Renders a segmented team list section with a leading team colour indicator and active count pill.
 */
function renderTeamGroup(
    title: string, teams: VolunteerTeamSummary[], eventSlug: string): React.ReactNode
{
    if (!teams.length)
        return null;

    return (
        <Stack spacing={0.75} useFlexGap>
            <SectionHeader title={title} />
            <ScheduleList variant="segmented">
                { teams.map(team => {
                    const activeLabel = pluralize(team.activeCount, 'active volunteer');

                    return (
                        <ScheduleListRow
                            key={team.slug}
                            chevron
                            href={getSchedulePath(eventSlug, `/volunteers/teams/${team.slug}`)}
                            leading={
                                <Box sx={{
                                    bgcolor: team.colour,
                                    borderRadius: '50%',
                                    height: 10,
                                    width: 10,
                                }} />
                            }
                            subtitle={formatTeamSubtitle(team)}
                            title={team.name}
                            trailing={team.activeCount > 0 ? (
                                <PillBadge label={team.activeCount} title={activeLabel} />
                            ) : undefined} />
                    );
                }) }
            </ScheduleList>
        </Stack>
    );
}

/**
 * Authenticates the request behind `<Suspense>` and renders the segmented volunteer teams hub, or
 * the direct team roster when the volunteer only has access to a single team.
 */
async function VolunteersHubContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);

    const teams = await getMockVolunteerTeams();
    if (!teams.length) {
        return (
            <EmptyStateCard
                description={`No volunteers have been assigned to ${event.shortName} yet.`} />
        );
    }

    if (teams.length === 1) {
        const singleTeam = await getMockVolunteerTeamDetail(teams[0].slug);
        if (!singleTeam) {
            return (
                <EmptyStateCard
                    description={`No volunteers have been assigned to ${event.shortName} yet.`} />
            );
        }

        return (
            <VolunteerTeamRoster
                eventSlug={event.slug}
                teamName={singleTeam.name}
                volunteers={singleTeam.volunteers} />
        );
    }

    const userTeams = teams.filter(team => team.isUserTeam);
    const otherTeams = teams.filter(team => !team.isUserTeam);

    return (
        <Stack spacing={2} useFlexGap>
            {renderTeamGroup('Your team', userTeams, event.slug)}
            {renderTeamGroup(userTeams.length > 0 ? 'Other teams' : 'Teams', otherTeams, event.slug)}
        </Stack>
    );
}

/**
 * Volunteers hub page for the schedule portal.
 */
export default function ScheduleVolunteersPage(props: PageProps<'/schedule2/[event]/volunteers'>) {
    return (
        <Page
            header={
                <Header
                    description="Directory of participating volunteers and team leads."
                    icon={ <GroupOutlinedIcon /> }
                    title="Volunteers" />
            }>
            <SuspenseReveal
                fallback={
                    <SegmentedListSkeleton
                        chevron
                        leading="dot"
                        rows={[
                            { subtitleWidth: 195, titleWidth: 92 },
                            { subtitleWidth: 170, titleWidth: 118 },
                            { subtitleWidth: 160, titleWidth: 84 },
                            { subtitleWidth: 185, titleWidth: 108 },
                        ]} />
                }>
                <VolunteersHubContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Volunteers', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
