// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import SsidChartIcon from '@mui/icons-material/SsidChart';

import type { AccessControl } from '@lib/auth/AccessControl';
import type { EventRecentChangeUpdate, EventRecentChangesProps } from './EventRecentChanges';
import type { NextPageParams } from '@lib/NextRouterParams';
import { EventDeadlines } from './EventDeadlines';
import { EventIdentityCard } from './EventIdentityCard';
import { EventMetadata } from './EventMetadata';
import { EventRecentChanges } from './EventRecentChanges';
import { EventRecentVolunteers } from './EventRecentVolunteers';
import { EventSeniors } from './EventSeniors';
import { EventTeamCard } from './EventTeamCard';
import { EventTeamHistoryGraph } from './EventTeamHistoryGraph';
import { Temporal, isAfter } from '@lib/Temporal';
import { TicketSalesTopLineGraph } from './finance/graphs/TicketSalesTopLineGraph';
import { generateEventMetadataFn } from './generateEventMetadataFn';
import { isAvailabilityWindowOpen } from '@lib/isAvailabilityWindowOpen';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEvents, tEventsDeadlines, tEventsTeams, tRoles, tStorage, tTeams,
    tTrainingsAssignments, tTrainings, tUsersEvents, tUsers, tHotels, tHotelsAssignments,
    tHotelsBookings, tHotelsPreferences, tRefunds } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Updates within how many minutes of each other should be merged together?
 */
const kMergeUpdateWindowMinutes = 60;

/**
 * Returns the deadlines that exist for a particular event, so that they can be displayed on the
 * dashboard page for everyone to see.
 */
async function getEventDeadlines(eventId: number) {
    const usersJoin = tUsers.forUseInLeftJoin();

    const dbInstance = db;
    return db.selectFrom(tEventsDeadlines)
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tEventsDeadlines.deadlineOwnerId))
        .select({
            id: tEventsDeadlines.deadlineId,
            date: dbInstance.dateAsString(tEventsDeadlines.deadlineDate),
            title: tEventsDeadlines.deadlineTitle,
            description: tEventsDeadlines.deadlineDescription,
            owner: usersJoin.name,
        })
        .where(tEventsDeadlines.eventId.equals(eventId))
            .and(tEventsDeadlines.deadlineCompleted.isNull())
            .and(tEventsDeadlines.deadlineDeleted.isNull())
        .orderBy(tEventsDeadlines.deadlineDate, 'asc')
            .orderBy(tEventsDeadlines.deadlineTitle, 'asc')
        .executeSelectMany();
}

/**
 * Returns metadata about the event that's being shown, including hotel & training status and
 * remaining time until the event is about to kick off.
 */
async function getEventMetadata(eventId: number) {
    const dbInstance = db;

    const hotelAssignmentsQuery = dbInstance.selectFrom(tHotelsAssignments)
        .innerJoin(tHotelsBookings)
            .on(tHotelsBookings.bookingId.equals(tHotelsAssignments.bookingId))
        .where(tHotelsAssignments.eventId.equals(eventId))
            .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
        .selectCountAll()
        .forUseAsInlineQueryValue();

    const hotelBookingsQuery = dbInstance.selectFrom(tHotelsBookings)
        .where(tHotelsBookings.eventId.equals(eventId))
            .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
        .selectCountAll()
        .forUseAsInlineQueryValue();

    const hotelOptionsQuery = dbInstance.selectFrom(tHotels)
        .where(tHotels.eventId.equals(eventId))
            .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
        .selectCountAll()
        .forUseAsInlineQueryValue();

    const trainingAssignmentsQuery = dbInstance.selectFrom(tTrainingsAssignments)
        .where(tTrainingsAssignments.eventId.equals(eventId))
            .and(tTrainingsAssignments.assignmentTrainingId.isNotNull())
        .selectCountAll()
        .forUseAsInlineQueryValue();

    const trainingSessionsQuery = dbInstance.selectFrom(tTrainings)
        .where(tTrainings.eventId.equals(eventId))
            .and(tTrainings.trainingVisible.equals(/* true= */ 1))
        .selectCountAll()
        .forUseAsInlineQueryValue();

    return await dbInstance.selectFromNoTable()
        .select({
            hotelAssignments: hotelAssignmentsQuery,
            hotelBookings: hotelBookingsQuery,
            hotelOptions: hotelOptionsQuery,
            trainingAssignments: trainingAssignmentsQuery,
            trainingSessions: trainingSessionsQuery,
        })
        .executeSelectNoneOrOne() ?? undefined;
}

/**
 * Returns the teams that participate in the event, together with some high-level metainformation
 * about whether the teams have published their information pages, registration portal and schedule.
 */
async function getParticipatingTeams(eventId: number) {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const dbInstance = db;
    const teams = await dbInstance.selectFrom(tEvents)
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tEvents.eventId))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
            .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
            .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .where(tEvents.eventId.equals(eventId))
        .select({
            id: tTeams.teamId,

            teamName: tTeams.teamName,
            teamColour: tTeams.teamColourLightTheme,
            teamTargetSize: tEventsTeams.teamTargetSize,
            teamSize: dbInstance.count(usersEventsJoin.userId),

            enableApplications: {
                start: tEventsTeams.enableApplicationsStart,
                end: tEventsTeams.enableApplicationsEnd,
            },
            enableRegistration: {
                start: tEventsTeams.enableRegistrationStart,
                end: tEventsTeams.enableRegistrationEnd,
            },
            enableSchedule: {
                start: tEventsTeams.enableScheduleStart,
                end: tEventsTeams.enableScheduleEnd,
            },
        })
        .groupBy(tEventsTeams.teamId)
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    return teams.map(team => ({
        ...team,
        enableApplications: isAvailabilityWindowOpen(team.enableApplications),
        enableRegistration: isAvailabilityWindowOpen(team.enableRegistration),
        enableSchedule: isAvailabilityWindowOpen(team.enableSchedule),
    }));
}

/**
 * Returns the most recent changes made by volunteers who are part of the event, for example when
 * they share their preferences. This helps volunteers look out for potential changes.
 */
async function getRecentChanges(access: AccessControl, event: string, eventId: number) {
    const hotelsPreferencesJoin = tHotelsPreferences.forUseInLeftJoin();
    const refundsJoin = tRefunds.forUseInLeftJoin();
    const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

    const preferenceUpdates = await db.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .leftJoin(hotelsPreferencesJoin)
            .on(hotelsPreferencesJoin.userId.equals(tUsersEvents.userId))
            .and(hotelsPreferencesJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(refundsJoin)
            .on(refundsJoin.userId.equals(tUsersEvents.userId))
            .and(refundsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
            .and(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
        .where(tUsersEvents.eventId.equals(eventId))
        .select({
            userId: tUsersEvents.userId,
            name: tUsers.firstName,
            team: tTeams.teamSlug,
            teamName: tTeams.teamName,
            status: tUsersEvents.registrationStatus,

            applicationCreated: tUsersEvents.registrationDate,
            availabilityPreferencesUpdated: tUsersEvents.preferencesUpdated,
            hotelPreferencesUpdated: hotelsPreferencesJoin.hotelPreferencesUpdated,
            refundRequestUpdated: refundsJoin.refundRequested,
            trainingPreferencesUpdated: trainingsAssignmentsJoin.preferenceUpdated,
        })
        .executeSelectMany();

    const teamAccess: Map<string, boolean> = new Map;

    const changes: EventRecentChangesProps['changes'] = [];
    for (const preferenceUpdate of preferenceUpdates) {
        if (!teamAccess.has(preferenceUpdate.team)) {
            teamAccess.set(preferenceUpdate.team, access.can('event.visible', {
                event,
                team: preferenceUpdate.team,
            }));
        }

        if (!teamAccess.get(preferenceUpdate.team))
            continue;  // the volunteer is not able to see volunteers from this team

        const commonChange = {
            name: preferenceUpdate.name,
            userId: preferenceUpdate.userId,
            team: preferenceUpdate.team,
            teamName: preferenceUpdate.teamName,
            status: preferenceUpdate.status,
        };

        // Applications will never be merged with other updates, as they are important.
        if (!!preferenceUpdate.applicationCreated) {
            changes.push({
                ...commonChange,
                updates: [ 'application' ],

                // Availability preferences will be updated as part of the application process, so
                // subtract a second from the application to make sure it's listed below the update.
                date: preferenceUpdate.applicationCreated.subtract({ seconds: 1 }),
            });
        }

        if (preferenceUpdate.status !== kRegistrationStatus.Accepted)
            continue;

        // Refund requests will never be merged with other updates, as they are important.
        if (!!preferenceUpdate.refundRequestUpdated) {
            changes.push({
                ...commonChange,
                updates: [ 'refund' ],
                date: preferenceUpdate.refundRequestUpdated
            });
        }

        // Merge the volunteer's updates to availability, hotel and training preferences together
        // to the same moment in case they all happened within an hour of each other.
        const updatesToVerify: { [k in EventRecentChangeUpdate]?: Temporal.ZonedDateTime } = {};

        if (!!preferenceUpdate.availabilityPreferencesUpdated)
            updatesToVerify['availability'] = preferenceUpdate.availabilityPreferencesUpdated;
        if (!!preferenceUpdate.hotelPreferencesUpdated)
            updatesToVerify['hotel'] = preferenceUpdate.hotelPreferencesUpdated;
        if (!!preferenceUpdate.trainingPreferencesUpdated)
            updatesToVerify['training'] = preferenceUpdate.trainingPreferencesUpdated;

        // (1) Align all changes on the timestamp of the most recent update, when within the window.
        for (const [ lhsChange, lhsUpdated ] of Object.entries(updatesToVerify)) {
            for (const [ rhsChange, rhsUpdated ] of Object.entries(updatesToVerify)) {
                if (lhsChange === rhsChange)
                    continue;  // don't "merge" a change to itself

                const difference = lhsUpdated.until(rhsUpdated, { largestUnit: 'minutes' });
                const absoluteDifferenceInMinutes = Math.abs(difference.minutes);
                if (absoluteDifferenceInMinutes > kMergeUpdateWindowMinutes)
                    continue;  // the updates were made too far apart

                if (isAfter(lhsUpdated, rhsUpdated))
                    updatesToVerify[rhsChange as EventRecentChangeUpdate] = lhsUpdated;
                else
                    updatesToVerify[lhsChange as EventRecentChangeUpdate] = rhsUpdated;
            }
        }

        // (2) Merge all the changes together and report them as updates.
        for (const [ lhsChange, lhsUpdated ] of Object.entries(updatesToVerify)) {
            if (!Object.hasOwn(updatesToVerify, lhsChange))
                continue;  // this change has been merged

            const updates: EventRecentChangeUpdate[] = [
                lhsChange as EventRecentChangeUpdate
            ];

            // (2a) Execute the merge. We compare microseconds, but they'll be identical anyway.
            for (const [ rhsChange, rhsUpdated ] of Object.entries(updatesToVerify)) {
                if (lhsChange === rhsChange)
                    continue;  // don't "merge" a change to itself
                if (lhsUpdated.epochMilliseconds !== rhsUpdated.epochMilliseconds)
                    continue;  // the changes happened at different moments

                const update = rhsChange as EventRecentChangeUpdate;

                updates.push(update);
                delete updatesToVerify[update];
            }

            // (2b) Announce the change, so that it can be rendered on the dashboard.
            changes.push({ ...commonChange, updates, date: lhsUpdated });
        }
    }

    changes.sort((lhs, rhs) =>
        Temporal.ZonedDateTime.compare(rhs.date, lhs.date));

    return changes.slice(0, 12).map(change => ({
        ...change,
        date: change.date.toString(),
    }));
}

/**
 * Returns the volunteers who most recently signed up to participate in the event.
 */
async function getRecentVolunteers(access: AccessControl, event: string, eventId: number) {
    const storageJoin = tStorage.forUseInLeftJoin();

    const volunteers = await db.selectFrom(tEvents)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.eventId.equals(tEvents.eventId))
            .and(tUsersEvents.registrationStatus.notIn([
                kRegistrationStatus.Cancelled, kRegistrationStatus.Rejected ]))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .where(tUsersEvents.eventId.equals(eventId))
        .select({
            userId: tUsers.userId,
            avatarHash: storageJoin.fileHash,
            team: tTeams.teamSlug,
            name: tUsers.name,
            status: tUsersEvents.registrationStatus,
        })
        .orderBy(tUsersEvents.registrationDate, 'desc')
        .orderBy(/* fallback for older events= */ tUsers.username, 'asc')
        .executeSelectMany();

    return volunteers.filter(volunteer => {
        return access.can('event.visible', {
            event,
            team: volunteer.team,
        });
    }).slice(0, /* based on the width of the component= */ 9);
}

/**
 * Returns the Senior-level engineers that participate in the event, which is defined as any role
 * that grants administrator access to the event.
 */
async function getSeniorVolunteers(access: AccessControl, event: string, eventId: number) {
    const rolesJoin = tRoles.forUseInLeftJoin();
    const storageJoin = tStorage.forUseInLeftJoin();

    const seniors = await db.selectFrom(tEvents)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.eventId.equals(tEvents.eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(tUsersEvents.roleId))
        .where(tUsersEvents.eventId.equals(eventId))
            .and(rolesJoin.rolePermissionGrant.isNotNull())
        .select({
            userId: tUsers.userId,
            avatarHash: storageJoin.fileHash,
            team: tTeams.teamSlug,
            name: tUsers.name,
            status: tUsersEvents.registrationStatus,
        })
        .orderBy(rolesJoin.roleOrder, 'asc')
        .orderBy(tUsers.username, 'asc')
        .executeSelectMany();

    return seniors.map(senior => ({
        ...senior,
        accessible: access.can('event.visible', {
            event,
            team: senior.team,
        }),
    }));
}

/**
 * The <EventPage> component gathers the required information for the event-specific dashboard,
 * which concisely displays the status and progress of organising an individual event.
 */
export default async function EventPage(props: NextPageParams<'event'>) {
    const { access, event } = await verifyAccessAndFetchPageInfo(props.params);

    const deadlines = await getEventDeadlines(event.id);
    const eventMetadata = await getEventMetadata(event.id);
    const participatingTeams = await getParticipatingTeams(event.id);
    const recentChanges = await getRecentChanges(access, event.slug, event.id);
    const recentVolunteers = await getRecentVolunteers(access, event.slug, event.id);
    const seniorVolunteers = await getSeniorVolunteers(access, event.slug, event.id);

    const canAccessFinanceStatistics = access.can('statistics.finances');

    return (
        <Grid container spacing={2} alignItems="stretch">
            <Grid size={{ xs: 3 }}>
                <EventIdentityCard event={event} />
            </Grid>
            { participatingTeams.map((team, index) =>
                <Grid key={`team-${index}`} size={{ xs: 3 }}>
                    <EventTeamCard {...team} graph={
                        <EventTeamHistoryGraph eventId={event.id} teamId={team.id} />
                    } />
                </Grid> ) }
            <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="column" spacing={2}>
                    <EventMetadata event={event} metadata={eventMetadata}
                                   hotelEnabled={event.hotelEnabled}
                                   trainingEnabled={event.trainingEnabled} />
                    { recentChanges.length > 0 &&
                        <EventRecentChanges changes={recentChanges} event={event} /> }
                </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="column" spacing={2}>
                    { deadlines.length > 0 &&
                        <EventDeadlines event={event} deadlines={deadlines} /> }
                    { !!canAccessFinanceStatistics &&
                        <Card>
                            <CardHeader avatar={ <SsidChartIcon color="primary" /> }
                                        title={`${event.shortName} ticket sales`}
                                        titleTypographyProps={{ variant: 'subtitle2' }} />
                            <Divider />
                            <CardContent sx={{ p: '0 !important' }}>
                                <TicketSalesTopLineGraph eventId={event.id} height={250}
                                                         loadingGraphPadding={2} />
                            </CardContent>
                            <Divider />
                            <CardActions sx={{ justifyContent: 'flex-end' }}>
                                <Button LinkComponent={Link}
                                        href={`/admin/events/${event.slug}/finance`}
                                        size="small">
                                    Learn more
                                </Button>
                            </CardActions>
                        </Card> }
                    { (!canAccessFinanceStatistics && recentVolunteers.length > 0) &&
                        <EventRecentVolunteers event={event} volunteers={recentVolunteers} /> }
                    { (!canAccessFinanceStatistics && seniorVolunteers.length > 0) &&
                        <EventSeniors event={event} volunteers={seniorVolunteers} /> }
                </Stack>
            </Grid>
        </Grid>
    );
}

export const generateMetadata = generateEventMetadataFn();
