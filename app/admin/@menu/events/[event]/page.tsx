// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import LanguageIcon from '@mui/icons-material/Language';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import RepeatIcon from '@mui/icons-material/Repeat';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import type { NavigationTopLevelItem } from '@app/admin/layout/NavigationItem';
import { NavigationMenu } from '../../../layout/NavigationMenu';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tEventsTeams, tTeams } from '@lib/database';

/**
 * This variant of the parallel route composes the menu for a particular event, including the teams
 * that are participating in that event. Rich, real-time information is conveyed.
 */
export default async function EventMenu(props: PageProps<'/admin/events/[event]'>) {
    const { access, event, user } = await requireAuthenticationWithEvent(props);

    const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();

    // TODO: Cache this query, or reuse the getEvent()/getTeam() caches somehow
    // TODO: Badge for "settings" when dates have not been published yet

    const dbInstance = db;
    const context = await dbInstance.selectFrom(tEvents)
        .leftJoin(eventsTeamsJoin)
            .on(eventsTeamsJoin.eventId.equals(tEvents.eventId))
            .and(eventsTeamsJoin.enableTeam.equals(/* true= */ 1))
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(eventsTeamsJoin.teamId))
        .where(tEvents.eventSlug.equals(event.slug))
        .select({
            teams: dbInstance.aggregateAsArray({
                id: teamsJoin.teamId,
                name: teamsJoin.teamName,
                slug: teamsJoin.teamSlug,
                color: teamsJoin.teamColourLightTheme,

                flagEnableDutyBook: teamsJoin.teamFlagEnableDutyBook.equals(/* true= */ 1),
                flagEnableScheduling: teamsJoin.teamFlagEnableScheduling.equals(/* true= */ 1),
                flagManagesContent: teamsJoin.teamFlagManagesContent.equals(/* true= */ 1),
                flagManagesFaq: teamsJoin.teamFlagManagesFaq.equals(/* true= */ 1),
                flagManagesFirstAid: teamsJoin.teamFlagManagesFirstAid.equals(/* true= */ 1),
                flagManagesSecurity: teamsJoin.teamFlagManagesSecurity.equals(/* true= */ 1),
            }),
        })
        .groupBy(tEvents.eventId)
        .executeSelectNoneOrOne();

    if (!context)
        notFound();

    const eventScope = { event: event.slug };

    const items: NavigationTopLevelItem[] = [
        {
            Icon: DashboardOutlinedIcon,
            label: 'Dashboard',
            url: `/admin/events/${event.slug}`,
            urlMatchMode: 'strict',
        },
        {
            Icon: AnalyticsOutlinedIcon,
            condition: !!event.integrations?.yourTicketProviderEventId ||
                       !!event.integrations?.weeztixGuid,
            label: 'Finances',
            permission: {
                permission: 'statistics.finances',
            },
            url: `/admin/events/${event.slug}/finance`,
        },
        {
            Icon: HotelIcon,
            badge: { migration: true, value: true },  // migration not started
            condition: event.flags.enableHotel,
            label: 'Hotels',
            permission: {
                permission: 'event.hotels',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/hotels`,
        },
        {
            Icon: EventNoteIcon,
            condition: !!event.integrations?.anPlanFestivalId,
            label: 'Program',
            url: `/admin/events/${event.slug}/program/requests`,
            urlPrefix: `/admin/events/${event.slug}/program`,
        },
        {
            Icon: MonetizationOnIcon,
            badge: { migration: true, value: true },  // migration not started
            condition: event.flags.enableRefunds,
            label: 'Refunds',
            permission: {
                permission: 'event.refunds',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/refunds`,
        },
        {
            Icon: LocalActivityOutlinedIcon,
            condition: !!event.tickets?.volunteerTicketId,
            label: 'Tickets',
            permission: {
                permission: 'volunteers.tickets',
                operation: 'read',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/tickets/volunteers`,
            urlPrefix: `/admin/events/${event.slug}/tickets`,
        },
        {
            Icon: HistoryEduIcon,
            badge: { migration: true, value: true },  // migration not started
            condition: event.flags.enableTraining,
            label: 'Trainings',
            permission: {
                permission: 'event.trainings',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/training`,
        },
        {
            Icon: SettingsOutlinedIcon,
            label: 'Settings',
            permission: {
                permission: 'event.settings',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/settings/configuration`,
            urlPrefix: `/admin/events/${event.slug}/settings`,
        },
    ];

    const sortedTeams = context.teams.sort((lhs, rhs) => lhs.name!.localeCompare(rhs.name!));

    for (const team of sortedTeams) {
        const eventAndTeamScope = { event: event.slug, team: team.slug };
        items.push({
            color: team.color,
            header: team.name,
            id: `${event.slug}-${team.slug}`,
            items: [
                {
                    Icon: NewReleasesOutlinedIcon,
                    label: 'Applications',
                    permission: {
                        permission: 'volunteers.applications',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/applications`,
                },
                {
                    Icon: OutlinedFlagIcon,
                    label: 'Duty book',
                    url: `/admin/events/${event.slug}/${team.slug}/duty-book`,
                    condition: team.flagEnableDutyBook,
                },
                {
                    Icon: LocalHospitalIcon,
                    label: 'First aid',
                    permission: {
                        permission: 'event.vendors',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/first-aid`,
                    condition: team.flagManagesFirstAid,
                },
                {
                    Icon: LibraryBooksOutlinedIcon,
                    label: 'Knowledge base',
                    url: `/admin/events/${event.slug}/${team.slug}/knowledge`,
                    condition: team.flagManagesFaq,
                },
                {
                    Icon: RepeatIcon,
                    label: 'Retention',
                    permission: {
                        permission: 'volunteers.retention',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/retention`,
                },
                {
                    Icon: ScheduleIcon,
                    badge: { migration: true, value: true },  // migration not started
                    label: 'Schedule',
                    permission: {
                        permission: 'event.schedule.planning',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/schedule`,
                    condition: team.flagEnableScheduling,
                },
                {
                    Icon: SecurityIcon,
                    label: 'Security',
                    permission: {
                        permission: 'event.vendors',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/security`,
                    condition: team.flagManagesSecurity,
                },
                {
                    Icon: PendingActionsIcon,
                    label: 'Shifts',
                    permission: {
                        permission: 'event.shifts',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/shifts`,
                    condition: team.flagEnableScheduling,
                },
                {
                    Icon: PeopleAltOutlinedIcon,
                    label: 'Volunteers',
                    permission: {
                        permission: 'event.volunteers.information',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/volunteers`,
                },
                {
                    Icon: LanguageIcon,
                    label: 'Website',
                    url: `/admin/events/${event.slug}/${team.slug}/website/content`,
                    condition: team.flagManagesContent,
                },
            ],
        });
    }

    return (
        <NavigationMenu access={access} id="events" title={`AnimeCon ${event.slug}`} items={items}
                        userId={user.id} />
    );
}
