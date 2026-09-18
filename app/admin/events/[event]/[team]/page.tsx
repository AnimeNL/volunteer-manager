// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import GroupsIcon from '@mui/icons-material/Groups';
import LanguageIcon from '@mui/icons-material/Language';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import RepeatIcon from '@mui/icons-material/Repeat';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SecurityIcon from '@mui/icons-material/Security';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';

/**
 * Overview page for a team participating in an event. Displays a set of tiles that link through to
 * the individual sections. Made available to enable linkability in breadcrumbs.
 */
export default async function EventTeamPage(props: PageProps<'/admin/events/[event]/[team]'>) {
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props);

    const scope = { event: event.slug, team: team.slug };

    const tiles = [];

    if (access.can('volunteers.applications', 'read', scope)) {
        tiles.push({
            Icon: NewReleasesOutlinedIcon,
            href: `/admin/events/${event.slug}/${team.slug}/applications`,
            label: 'Applications',
        });
    }

    if (team.flags.enableDutyBook) {
        tiles.push({
            Icon: OutlinedFlagIcon,
            href: `/admin/events/${event.slug}/${team.slug}/duty-book`,
            label: 'Duty book',
        });
    }

    if (team.flags.managesFirstAid && access.can('event.vendors', 'read', scope)) {
        tiles.push({
            Icon: LocalHospitalIcon,
            href: `/admin/events/${event.slug}/${team.slug}/first-aid`,
            label: 'First aid',
        });
    }

    if (team.flags.managesKnowledgeBase) {
        tiles.push({
            Icon: LibraryBooksOutlinedIcon,
            href: `/admin/events/${event.slug}/${team.slug}/knowledge`,
            label: 'Knowledge base',
        });
    }

    if (access.can('event.retention', 'read', scope)) {
        tiles.push({
            Icon: RepeatIcon,
            href: `/admin/events/${event.slug}/${team.slug}/retention`,
            label: 'Retention',
        });
    }

    if (team.flags.enableScheduling && access.can('event.schedule.planning', 'read', scope)) {
        tiles.push({
            Icon: ScheduleIcon,
            href: `/admin/events/${event.slug}/${team.slug}/schedule`,
            label: 'Schedule',
        });
    }

    if (team.flags.managesSecurity && access.can('event.vendors', 'read', scope)) {
        tiles.push({
            Icon: SecurityIcon,
            href: `/admin/events/${event.slug}/${team.slug}/security`,
            label: 'Security',
        });
    }

    if (team.flags.enableScheduling && access.can('event.shifts', 'read', scope)) {
        tiles.push({
            Icon: PendingActionsIcon,
            href: `/admin/events/${event.slug}/${team.slug}/shifts`,
            label: 'Shifts',
        });
    }

    if (access.can('event.volunteers.information', 'read', scope)) {
        tiles.push({
            Icon: PeopleAltOutlinedIcon,
            href: `/admin/events/${event.slug}/${team.slug}/volunteers`,
            label: 'Volunteers',
        });
    }

    if (team.flags.managesContent) {
        tiles.push({
            Icon: LanguageIcon,
            href: `/admin/events/${event.slug}/${team.slug}/website`,
            label: 'Website',
        });
    }

    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title={team.name}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title },
                     ]}>
                <SectionIntroduction>
                    Collection of pages that provide tools to manage {team.name} during
                    { ' ' }{event.shortName}.
                </SectionIntroduction>
            </Section>
            <OverviewTiles tiles={tiles} />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ team: 'team' }, { event: 'event' });
