// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LanguageIcon from '@mui/icons-material/Language';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PersonIcon from '@mui/icons-material/Person';
import RepeatIcon from '@mui/icons-material/Repeat';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import type { NavigationTopLevelItem } from '@app/admin/layout/NavigationItem';
import { NavigationMenu } from '../../../layout/NavigationMenu';
import { requireAuthenticationContextWithEvent }
    from '@app/admin/events/[event]/requireAuthenticationContextWithEvent';
import db, { tEvents, tEventsTeams, tTeams } from '@lib/database';

/**
 * This variant of the parallel route composes the menu for a particular event, including the teams
 * that are participating in that event. Rich, real-time information is conveyed.
 */
export default async function EventMenu(props: LayoutProps<'/admin/events/[event]'>) {
    const { access, event, user } = await requireAuthenticationContextWithEvent(props);

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
            event: {
                hotelEnabled: tEvents.hotelEnabled.equals(/* true= */ 1),
                refundEnabled: tEvents.refundEnabled.equals(/* true= */ 1),
                trainingEnabled: tEvents.trainingEnabled.equals(/* true= */ 1),
            },
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
            badge: { severity: 'warning', value: true },  // migration in progress
            label: 'Dashboard',
            url: `/admin/events/${event.slug}`,
            urlMatchMode: 'strict',
        },
        {
            Icon: AnalyticsOutlinedIcon,
            badge: { severity: 'error', value: true },  // migration not started
            // TODO: Condition on availability
            label: 'Finances',
            permission: {
                permission: 'statistics.finances',
            },
            url: `/admin/events/${event.slug}/finance`,
        },
        {
            Icon: HotelIcon,
            badge: { severity: 'error', value: true },  // migration not started
            condition: context.event.hotelEnabled,
            label: 'Hotels',
            permission: {
                permission: 'event.hotels',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/hotels`,
        },
        {
            Icon: EventNoteIcon,
            badge: { severity: 'error', value: true },  // migration not started
            condition: !!event.integrations?.anPlanFestivalId,
            label: 'Program',
            url: `/admin/events/${event.slug}/program`,
        },
        {
            Icon: MonetizationOnIcon,
            badge: { severity: 'error', value: true },  // migration not started
            condition: context.event.refundEnabled,
            label: 'Refunds',
            permission: {
                permission: 'event.refunds',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/refunds`,
        },
        {
            Icon: LocalActivityOutlinedIcon,
            badge: { severity: 'success', value: true },  // migration completed
            condition:
                !!event.integrations?.weeztixGuid || !!event.integrations?.yourTicketProviderId,
            label: 'Tickets',
            permission: {
                permission: 'event.tickets',
                operation: 'read',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/tickets/volunteers`,
            urlPrefix: `/admin/events/${event.slug}/tickets`,
        },
        {
            Icon: HistoryEduIcon,
            badge: { severity: 'error', value: true },  // migration not started
            condition: context.event.trainingEnabled,
            label: 'Trainings',
            permission: {
                permission: 'event.trainings',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/training`,
        },
        {
            Icon: SettingsOutlinedIcon,
            badge: { severity: 'success', value: true },  // migration completed
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
                    Icon: NewReleasesIcon,
                    badge: { severity: 'error', value: true },  // migration not started
                    label: 'Applications',
                    permission: {
                        permission: 'event.applications',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/applications`,
                },
                {
                    Icon: OutlinedFlagIcon,
                    badge: { severity: 'success', value: true },  // migration completed
                    label: 'Duty book',
                    url: `/admin/events/${event.slug}/${team.slug}/duty-book`,
                    condition: team.flagEnableDutyBook,
                },
                {
                    Icon: LocalHospitalIcon,
                    badge: { severity: 'error', value: true },  // migration not started
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
                    Icon: InfoOutlinedIcon,
                    badge: { severity: 'error', value: true },  // migration not started
                    label: 'Knowledge base',
                    url: `/admin/events/${event.slug}/${team.slug}/knowledge`,
                    condition: team.flagManagesFaq,
                },
                {
                    Icon: RepeatIcon,
                    badge: { severity: 'error', value: true },  // migration not started
                    label: 'Retention',
                    permission: {
                        permission: 'event.retention',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/${team.slug}/retention`,
                },
                {
                    Icon: ScheduleIcon,
                    badge: { severity: 'error', value: true },  // migration not started
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
                    badge: { severity: 'error', value: true },  // migration not started
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
                    badge: { severity: 'error', value: true },  // migration not started
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
                    Icon: PersonIcon,
                    badge: { severity: 'warning', value: true },  // migration in progress
                    label: 'Volunteers',
                    permission: {
                        permission: 'event.volunteers.information',
                        operation: 'read',
                        scope: eventAndTeamScope,
                    },
                    url: `/admin/events/${event.slug}/crew/volunteers`,
                },
                {
                    Icon: LanguageIcon,
                    badge: { severity: 'error', value: true },  // migration not started
                    label: 'Website',
                    url: `/admin/events/${event.slug}/${team.slug}/website`,
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
