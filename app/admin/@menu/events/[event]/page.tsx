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
import { Cache } from '@lib/cache';
import { NavigationMenu } from '../../../layout/NavigationMenu';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivities, tEvents, tEventsTeams, tHotels, tHotelsBookings, tRoles, tShifts, tTeams,
    tTrainingsAssignments, tTrainingsExtra, tUsersEvents, tUsersEventsPreferencesHotel,
    tUsersEventsPreferencesTraining } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * This variant of the parallel route composes the menu for a particular event, including the teams
 * that are participating in that event. Rich, real-time information is conveyed.
 */
export default async function EventMenu(props: PageProps<'/admin/events/[event]'>) {
    const { access, event, user } = await requireAuthenticationWithEvent(props);

    // TODO: Badge for "settings" when dates have not been published yet

    const cache = Cache.getInstance('AdminNavigationMenuCache');
    const context = await cache.getOrInsert(event.slug, async () => {
        const dbInstance = db;

        const hotelsBookingsJoin = tHotelsBookings.forUseInLeftJoin();
        const shiftsJoin = tShifts.forUseInLeftJoin();
        const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();
        const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

        const hotelsBadgeValue = dbInstance.selectFrom(tUsersEventsPreferencesHotel)
            .innerJoin(tHotels)
                .on(tHotels.hotelId.equals(tUsersEventsPreferencesHotel.hotelRoomId))
                    .and(tHotels.hotelRoomDeleted.isNull())
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tUsersEventsPreferencesHotel.userId))
                    .and(tUsersEvents.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .leftJoin(hotelsBookingsJoin)
                .on(hotelsBookingsJoin.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                    .and(hotelsBookingsJoin.bookingDeleted.isNull())
                    .and(hotelsBookingsJoin.bookingFirstUserId.equals(
                        tUsersEventsPreferencesHotel.userId).or(
                        hotelsBookingsJoin.bookingSecondUserId.equals(
                            tUsersEventsPreferencesHotel.userId)).or(
                        hotelsBookingsJoin.bookingThirdUserId.equals(
                            tUsersEventsPreferencesHotel.userId)))
            .where(tUsersEventsPreferencesHotel.eventId.equals(event.id))
                .and(tUsersEventsPreferencesHotel.preferenceVersionIsLatest.equals(/* true= */ 1))
                .and(tUsersEventsPreferencesHotel.hotelRoomId.isNotNull())
                .and(tUsersEventsPreferencesHotel.hotelCheckIn.isNotNull())
                .and(tUsersEventsPreferencesHotel.hotelCheckOut.isNotNull())
                .and(hotelsBookingsJoin.bookingId.isNull())
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const programBadgeValue = dbInstance.selectFrom(tActivities)
            .leftJoin(shiftsJoin)
                .on(shiftsJoin.shiftActivityId.equals(tActivities.activityId))
                    .and(shiftsJoin.eventId.equals(event.id))
                    .and(shiftsJoin.shiftDeleted.isNull())
            .where(tActivities.activityFestivalId.equals(event.integrations?.anPlanFestivalId ?? 0))
                .and(tActivities.activityHelpNeeded.equals(/* true= */ 1))
                .and(tActivities.activityDeleted.isNull())
                .and(tActivities.activityRequestAssignee.isNull())
                .and(shiftsJoin.shiftId.isNull())
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const volunteerTrainingsBadgeValue = dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .innerJoin(tUsersEventsPreferencesTraining)
                .on(tUsersEventsPreferencesTraining.eventId.equals(tUsersEvents.eventId))
                    .and(tUsersEventsPreferencesTraining.userId.equals(tUsersEvents.userId))
                    .and(tUsersEventsPreferencesTraining.preferenceVersionIsLatest.equals(
                        /* true= */ 1))
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
                    .and(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
            .where(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(tUsersEvents.trainingEligible.equals(/* true= */ 1).or(
                    tRoles.roleTrainingEligible.equals(/* true= */ 1)))
                .and(trainingsAssignmentsJoin.assignmentUpdated.isNull())
            .selectOneColumn(dbInstance.countDistinct(tUsersEvents.userId))
            .forUseAsInlineQueryValue();

        const extraTrainingsBadgeValue = dbInstance.selectFrom(tTrainingsExtra)
            .innerJoin(tTrainingsAssignments)
                .on(tTrainingsAssignments.eventId.equals(tTrainingsExtra.eventId))
                    .and(tTrainingsAssignments.assignmentExtraId.equals(
                        tTrainingsExtra.trainingExtraId))
            .where(tTrainingsExtra.eventId.equals(event.id))
                .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
                .and(tTrainingsAssignments.preferenceUpdated.isNotNull())
                .and(tTrainingsAssignments.assignmentUpdated.isNull())
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();
        const teamsJoin = tTeams.forUseInLeftJoin();

        const result = await dbInstance.selectFrom(tEvents)
            .leftJoin(eventsTeamsJoin)
                .on(eventsTeamsJoin.eventId.equals(tEvents.eventId))
                    .and(eventsTeamsJoin.enableTeam.equals(/* true= */ 1))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(eventsTeamsJoin.teamId))
                    .and(teamsJoin.teamDeleted.isNull())
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.eventId.equals(eventsTeamsJoin.eventId))
                    .and(usersEventsJoin.teamId.equals(eventsTeamsJoin.teamId))
                    .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Registered))
            .where(tEvents.eventId.equals(event.id))
            .select({
                badges: {
                    hotels: hotelsBadgeValue,
                    program: programBadgeValue,
                    trainings: volunteerTrainingsBadgeValue.add(extraTrainingsBadgeValue),
                },
                team: {
                    id: teamsJoin.teamId,
                    name: teamsJoin.teamName,
                    slug: teamsJoin.teamSlug,
                    color: teamsJoin.teamColourLightTheme,
                    applications: dbInstance.count(usersEventsJoin.userId),

                    flagEnableDutyBook: teamsJoin.teamFlagEnableDutyBook.equals(/* true= */ 1),
                    flagEnableScheduling: teamsJoin.teamFlagEnableScheduling.equals(/* true= */ 1),
                    flagManagesContent: teamsJoin.teamFlagManagesContent.equals(/* true= */ 1),
                    flagManagesFaq: teamsJoin.teamFlagManagesFaq.equals(/* true= */ 1),
                    flagManagesFirstAid: teamsJoin.teamFlagManagesFirstAid.equals(/* true= */ 1),
                    flagManagesSecurity: teamsJoin.teamFlagManagesSecurity.equals(/* true= */ 1),
                },
            })
            .groupBy(tEvents.eventId, teamsJoin.teamId)
            .executeSelectMany();

        if (!result.length)
            return null;

        return {
            badges: result[0].badges,
            teams: result
                .map(entry => entry.team)
                .filter((team): team is NonNullable<typeof result[number]['team']> =>
                    !!team?.id && !!team.name && !!team.slug)
                .sort((lhs, rhs) => lhs.name!.localeCompare(rhs.name!)),
        };
    });

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
            badge: { value: context.badges.hotels },
            condition: event.flags.enableHotel,
            label: 'Hotels',
            permission: {
                permission: 'event.hotels',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/hotels/assignments`,
            urlPrefix: `/admin/events/${event.slug}/hotels`,
        },
        {
            Icon: EventNoteIcon,
            badge: {
                severity: 'warning',
                value: context.badges.program,
            },
            condition: !!event.integrations?.anPlanFestivalId,
            label: 'Program',
            url: `/admin/events/${event.slug}/program/requests`,
            urlPrefix: `/admin/events/${event.slug}/program`,
        },
        {
            Icon: MonetizationOnIcon,
            condition: event.flags.enableRefunds,
            label: 'Refunds',
            permission: {
                permission: 'volunteers.refunds',
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
            badge: { value: context.badges.trainings },
            condition: event.flags.enableTraining,
            label: 'Trainings',
            permission: {
                permission: 'event.trainings',
                scope: eventScope,
            },
            url: `/admin/events/${event.slug}/training/assignments`,
            urlPrefix: `/admin/events/${event.slug}/training`,
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

    for (const team of context.teams) {
        const eventAndTeamScope = { event: event.slug, team: team.slug };
        items.push({
            color: team.color,
            header: team.name,
            id: `${event.slug}-${team.slug}`,
            items: [
                {
                    Icon: NewReleasesOutlinedIcon,
                    badge: {
                        severity: 'error',
                        value: team.applications,
                    },
                    label: 'Applications',
                    permission: {
                        permission: 'volunteers.participation',
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
                        permission: 'volunteers.vendor-teams',
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
                        permission: 'volunteers.schedules',
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
                        permission: 'volunteers.vendor-teams',
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
                        permission: 'volunteers.shifts',
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
                        permission: 'volunteers.participation',
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
