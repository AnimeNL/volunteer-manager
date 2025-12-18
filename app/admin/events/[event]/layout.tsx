// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import RepeatIcon from '@mui/icons-material/Repeat';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';

import type { AccessScope } from '@lib/auth/AccessControl';
import type { User } from '@lib/auth/User';
import { AdminContent } from '../../AdminContent';
import { AdminPageContainer } from '../../AdminPageContainer';
import { type AdminSidebarMenuEntry, AdminSidebar } from '../../AdminSidebar';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import db, { tActivities, tEvents, tEventsSalesConfiguration, tEventsTeams, tHotelsAssignments,
    tHotelsBookings, tHotelsPreferences, tRefunds, tShifts, tTeams, tTrainingsAssignments,
    tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Fetch the information about the event identified by `eventSlug` that is applicable to the given
 * `user`, with access checks being in place. The menu will be rendered based on this information.
 */
async function fetchEventSidebarInformation(user: User, eventSlug: string) {
    const dbInstance = db;
    const pendingApplicationsJoin = dbInstance.selectFrom(tUsersEvents)
        .where(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Registered))
        .select({
            eventId: tUsersEvents.eventId,
            teamId: tUsersEvents.teamId,
            applications: dbInstance.count(tUsersEvents.userId),
        })
        .groupBy('teamId')
        .forUseInQueryAs('PendingApplications')
        .forUseInLeftJoinAs('PendingApplications');

    const financialProductCount = dbInstance.selectFrom(tEvents)
        .innerJoin(tEventsSalesConfiguration)
            .on(tEventsSalesConfiguration.eventId.equals(tEvents.eventId))
        .where(tEvents.eventSlug.equals(eventSlug))
        .selectCountAll()
        .forUseAsInlineQueryValue();

    const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    return await dbInstance.selectFrom(tEvents)
        .leftJoin(eventsTeamsJoin)
            .on(eventsTeamsJoin.eventId.equals(tEvents.eventId))
            .and(eventsTeamsJoin.enableTeam.equals(/* true= */ 1))
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(eventsTeamsJoin.teamId))
        .leftJoin(pendingApplicationsJoin)
            .on(pendingApplicationsJoin.eventId.equals(tEvents.eventId))
            .and(pendingApplicationsJoin.teamId.equals(teamsJoin.teamId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
            .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(usersEventsJoin.userId.equals(user.id))
        .where(tEvents.eventSlug.equals(eventSlug))
        .select({
            event: {
                id: tEvents.eventId,
                name: tEvents.eventShortName,
                slug: tEvents.eventSlug,
                festivalId: tEvents.eventFestivalId,

                hotelEnabled: tEvents.hotelEnabled.equals(/* true= */ 1),
                refundEnabled: tEvents.refundEnabled.equals(/* true= */ 1),
                trainingEnabled: tEvents.trainingEnabled.equals(/* true= */ 1),

                financialProductCount,
            },
            teams: dbInstance.aggregateAsArray({
                id: teamsJoin.teamId,
                name: teamsJoin.teamName,
                slug: teamsJoin.teamSlug,
                color: teamsJoin.teamColourLightTheme,

                flagEnableScheduling: teamsJoin.teamFlagEnableScheduling.equals(/* true= */ 1),
                flagManagesContent: teamsJoin.teamFlagManagesContent.equals(/* true= */ 1),
                flagManagesFaq: teamsJoin.teamFlagManagesFaq.equals(/* true= */ 1),
                flagManagesFirstAid: teamsJoin.teamFlagManagesFirstAid.equals(/* true= */ 1),
                flagManagesSecurity: teamsJoin.teamFlagManagesSecurity.equals(/* true= */ 1),

                pendingApplications: pendingApplicationsJoin.applications,
            }),
            user: {
                teamId: usersEventsJoin.teamId,
            },
        })
        .groupBy(tEvents.eventId)
        .executeSelectNoneOrOne();
}

/**
 * Layout of the event overview page in the volunteer portal administration area. This shows the
 * options available to Senior+ volunteers for the organisation of a particular event.
 */
export default async function EventLayout(props: LayoutProps<'/admin/events/[event]'>)
{
    const params = await props.params;

    if (typeof params.event !== 'string' || !params.event.length)
        notFound();

    const { access, user } = await requireAuthenticationContext();
    const { event } = params;

    const dbInstance = db;

    const info = await fetchEventSidebarInformation(user, event);
    if (!info)
        notFound();

    // Sort the teams included in the |info|. While JSON_ARRAYAGG accepts its own ORDER BY clause,
    // this is not yet supported by `ts-sql-query`. This'll do in the mean time.
    info.teams.sort((lhs, rhs) => lhs.name!.localeCompare(rhs.name!));

    // If the user has the ability to see any of the additional menu items, execute a single query
    // to understand how many outstanding items there are for hotels, refunds and trainings. Only
    // the ones that the user has permission to access will be populated.
    const canAccessHotels = access.can('event.hotels', { event });
    const canAccessRefunds = access.can('event.refunds', { event });
    const canAccessTrainings = access.can('event.trainings', { event });

    let hotelBadge: number | undefined;
    let refundsBadge: number | undefined;
    let trainingsBadge: number | undefined;

    if (canAccessHotels || canAccessRefunds || canAccessTrainings) {
        const hotelsAssignmentsJoin = tHotelsAssignments.forUseInLeftJoin();
        const hotelsBookingsJoin = tHotelsBookings.forUseInLeftJoin();

        const hotelSubQuery = dbInstance.selectFrom(tHotelsPreferences)
            .leftJoin(hotelsAssignmentsJoin)
                .on(hotelsAssignmentsJoin.assignmentUserId.equals(tHotelsPreferences.userId))
                    .and(hotelsAssignmentsJoin.eventId.equals(tHotelsPreferences.eventId))
            .leftJoin(hotelsBookingsJoin)
                .on(hotelsBookingsJoin.bookingId.equals(hotelsAssignmentsJoin.bookingId))
                    .and(hotelsBookingsJoin.bookingVisible.equals(/* true= */ 1))
            .where(tHotelsPreferences.eventId.equals(info.event.id))
                .and(tHotelsPreferences.hotelId.isNotNull())
                .and(hotelsAssignmentsJoin.assignmentId.isNull().or(
                    hotelsBookingsJoin.bookingConfirmed.equals(/* false= */ 0)))
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const refundsSubQuery = dbInstance.selectFrom(tRefunds)
            .where(tRefunds.eventId.equals(info.event.id))
                .and(tRefunds.refundConfirmed.isNull())
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const trainingsSubQuery = dbInstance.selectFrom(tTrainingsAssignments)
            .where(tTrainingsAssignments.eventId.equals(info.event.id))
                .and(tTrainingsAssignments.assignmentUserId.isNotNull())
                .and(tTrainingsAssignments.assignmentConfirmed.equals(/* false= */ 0))
            .selectCountAll()
            .forUseAsInlineQueryValue();

        const badgeValues = await dbInstance.selectFromNoTable()
            .select({
                unconfirmedHotelRequests: hotelSubQuery,
                unconfirmedRefunds: refundsSubQuery,
                unconfirmedTrainings: trainingsSubQuery,
            })
            .executeSelectNoneOrOne();

        if (canAccessHotels)
            hotelBadge = badgeValues?.unconfirmedHotelRequests;
        if (canAccessRefunds)
            refundsBadge = badgeValues?.unconfirmedRefunds;
        if (canAccessTrainings)
            trainingsBadge = badgeValues?.unconfirmedTrainings;
    }

    // Only display the "Program" entry when an event has been associated with a Festival ID. This
    // is how AnPlan maps the events, and we rely on the key to import information.
    const programEntry: AdminSidebarMenuEntry[] = [ /* empty */ ];
    if (!!info.event.festivalId) {
        const shiftsJoin = tShifts.forUseInLeftJoin();
        const unknownProgramEntries = await dbInstance.selectFrom(tActivities)
            .leftJoin(shiftsJoin)
                .on(shiftsJoin.shiftActivityId.equals(tActivities.activityId))
                    .and(shiftsJoin.eventId.equals(info.event.id))
            .where(tActivities.activityFestivalId.equals(info.event.festivalId))
                .and(tActivities.activityHelpNeeded.equals(/* true= */ 1))
                .and(tActivities.activityRequestAssignee.isNull())
                .and(tActivities.activityDeleted.isNull())
                .and(shiftsJoin.shiftId.isNull())
            .selectCountAll()
            .executeSelectOne();

        programEntry.push({
            icon: <EventNoteIcon />,
            label: 'Program',
            url: `/admin/events/${event}/program/requests`,
            urlPrefix: `/admin/events/${event}/program`,
            badge: unknownProgramEntries,
            badgeSeverity: 'error',
        });
    }

    // Display the number of uncategorised products for those with access to sales information. This
    // number should generally be zero, whereas any new entries need to be associated with an event.
    let uncategorisedProductCount: number | undefined;
    if (access.can('statistics.finances')) {
        uncategorisedProductCount = await dbInstance.selectFrom(tEventsSalesConfiguration)
            .where(tEventsSalesConfiguration.saleCategory.isNull())
            .selectCountAll()
            .executeSelectOne();
    }

    const volunteersMenu: AdminSidebarMenuEntry[] = [
        {
            icon: <GridViewIcon />,
            label: 'Dashboard',
            url: `/admin/events/${event}`,
            urlMatchMode: 'strict',
        },
        {
            icon: <AnalyticsOutlinedIcon />,
            label: 'Finances',
            condition: !!info.event.financialProductCount,
            permission: {
                permission: 'statistics.finances',
            },
            url: `/admin/events/${event}/finance`,
            badge: uncategorisedProductCount,
            badgeSeverity: 'error',
        },
        {
            icon: <HotelIcon />,
            label: 'Hotels',
            condition: info.event.hotelEnabled,
            permission: {
                permission: 'event.hotels',
                scope: { event },
            },
            url: `/admin/events/${event}/hotels`,
            badge: hotelBadge,
        },
        ...programEntry,
        {
            icon: <MonetizationOnIcon />,
            label: 'Refunds',
            condition: info.event.refundEnabled,
            permission: {
                permission: 'event.refunds',
                scope: { event },
            },
            url: `/admin/events/${event}/refunds`,
            badge: refundsBadge,
            badgeSeverity: 'error',
        },
        {
            icon: <HistoryEduIcon />,
            label: 'Trainings',
            condition: info.event.trainingEnabled,
            permission: {
                permission: 'event.trainings',
                scope: { event },
            },
            url: `/admin/events/${event}/training`,
            badge: trainingsBadge,
        },
        {
            icon: <SettingsIcon />,
            label: 'Settings',
            permission: {
                permission: 'event.settings',
                scope: { event },
            },
            url: `/admin/events/${event}/settings`,
        },
        {
            divider: true,
        }
    ];

    for (const team of info.teams) {
        const teamPermissionScope: AccessScope = {
            event,
            team: team.slug,
        };

        if (!access.can('event.visible', teamPermissionScope))
            continue;  // the volunteer does not have access to this team

        volunteersMenu.push({
            icon: <PeopleIcon htmlColor={team.color} />,
            label: team.name!,

            defaultOpen: info.user?.teamId === team.id,
            menu: [
                {
                    icon: <NewReleasesIcon />,
                    label: 'Applications',
                    permission: {
                        permission: 'event.applications',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/applications`,
                    badge: team.pendingApplications,
                    badgeSeverity: 'error',
                },
                {
                    icon: <FeedOutlinedIcon />,
                    label: 'Content',
                    url: `/admin/events/${event}/${team.slug}/content`,
                    condition: team.flagManagesContent,
                },
                {
                    icon: <InfoOutlinedIcon />,
                    label: 'Knowledge base',
                    url: `/admin/events/${event}/${team.slug}/knowledge`,
                    condition: team.flagManagesFaq,
                },
                {
                    icon: <LocalHospitalIcon />,
                    label: 'First aid',
                    permission: {
                        permission: 'event.vendors',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/first-aid`,
                    condition: team.flagManagesFirstAid,
                },
                {
                    icon: <RepeatIcon />,
                    label: 'Retention',
                    permission: {
                        permission: 'event.retention',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/retention`,
                },
                {
                    icon: <ScheduleIcon />,
                    label: 'Schedule',
                    permission: {
                        permission: 'event.schedule.planning',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/schedule`,
                    condition: team.flagEnableScheduling,
                },
                {
                    icon: <SecurityIcon />,
                    label: 'Security',
                    permission: {
                        permission: 'event.vendors',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/security`,
                    condition: team.flagManagesSecurity,
                },
                {
                    icon: <PendingActionsIcon />,
                    label: 'Shifts',
                    permission: {
                        permission: 'event.shifts',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/shifts`,
                    condition: team.flagEnableScheduling,
                },
                {
                    icon: <PersonIcon />,
                    label: 'Volunteers',
                    permission: {
                        permission: 'event.volunteers.information',
                        operation: 'read',
                        scope: teamPermissionScope,
                    },
                    url: `/admin/events/${event}/${team.slug}/volunteers`,
                },
            ],
        });
    }

    return (
        <AdminContent>
            <AdminSidebar access={access} menu={volunteersMenu} title={info.event.name} />
            <AdminPageContainer>
                {props.children}
            </AdminPageContainer>
        </AdminContent>
    )
}
