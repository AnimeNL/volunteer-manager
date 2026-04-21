// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Divider from '@mui/material/Divider';
import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';
import LanguageIcon from '@mui/icons-material/Language';
import Paper from '@mui/material/Paper';
import SettingsIcon from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';

import { NavigationTabs, type NavigationTabsProps } from '@app/admin/components/NavigationTabs';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEnvironments, tEventsTeams, tTeams } from '@lib/database';

/**
 * The <EventWebsiteLayout> layout surrounds the website pages, encapsulating both content and
 * settings that apply to the registration portal and timing-based access rules.
 */
export default async function EventWebsiteLayout(
    props: LayoutProps<'/admin/events/[event]/[team]/website'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesContent)
        notFound();

    const otherTeams = await db.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .innerJoin(tEnvironments)
            .on(tEnvironments.environmentId.equals(tTeams.teamEnvironmentId))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
            .and(tEventsTeams.teamId.notEquals(team.id))
            .and(tEnvironments.environmentDomain.equals(team.domain))
        .selectOneColumn(tTeams.teamName)
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    const finalOtherTeam = otherTeams.pop();

    const tabs: NavigationTabsProps['tabs'] = [
        {
            icon: <FeedOutlinedIcon />,
            label: 'Content',
            url: `/admin/events/${event.slug}/${team.slug}/website`,
        },
        {
            icon: <SettingsIcon />,
            label: 'Settings',
            url: `/admin/events/${event.slug}/${team.slug}/website/settings`,
        },
    ];

    return (
        <>
            <Section icon={ <LanguageIcon color="primary" /> } title="Website"
                     subtitle={team.domain} documentation="event/website">
                <SectionIntroduction>
                    Manage content and settings for <strong>{team.domain}</strong>, which is{' '}
                    { !finalOtherTeam && 'exclusively used for this team.' }
                    { !!finalOtherTeam &&
                        <>
                            shared with the
                            { otherTeams.length > 0 &&
                                <>
                                    { otherTeams.map(team => <>{' '}<strong>{team}</strong>, </>) }
                                    and the{' '}
                                </> }
                            <strong>{finalOtherTeam}</strong>.
                        </> }
                </SectionIntroduction>
            </Section>
            <Paper>
                <NavigationTabs tabs={tabs} />
                <Divider />
                <Stack direction="column" spacing={2} sx={{ p: 2 }}>
                    {props.children}
                </Stack>
            </Paper>
        </>
    );
}
