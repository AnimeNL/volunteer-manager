// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventVolunteerParticipation } from './Types';
import type { ProgramSlice } from './ProgramIndex';
import type { RawVolunteerRecord, TeamsSlice, VolunteersSlice } from './VolunteerIndex';
import type { ScheduleSlice, ShiftsSlice } from './ShiftIndex';
import { getBlobUrl } from '@lib/database/BlobStore';
import { kDefaultEventBoundaryEndHours, kDefaultEventBoundaryStartHours,
    parseAvailabilityExceptions } from './AvailabilityTimeline';
import { readSettings } from '@lib/Settings';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesTimeslots,
    tEventsTeams, tRoles, tSchedule, tShifts, tShiftsCategories, tStorage, tTeams,
    tTeamsVisibility, tUsers, tUsersEvents, tUsersEventsPreferencesAvailability }
    from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Parses a comma-separated list of requested AnPlan timeslot IDs into positive integers.
 */
function parseRequestedTimeslotIds(raw?: string | null): number[] {
    if (!raw || !raw.length)
        return [];

    const ids: number[] = [];
    for (const part of raw.split(',')) {
        const parsed = Number.parseInt(part.trim(), 10);
        if (Number.isInteger(parsed) && parsed > 0)
            ids.push(parsed);
    }

    return ids;
}

/**
 * Loads the event availability boundary hours from system settings.
 */
export async function loadEventBoundaryHours(): Promise<{
    beforeStart: number;
    afterEnd: number;
}> {
    const settings = await readSettings([
        'schedule-event-view-start-hours',
        'schedule-event-view-end-hours',
    ]);

    return {
        beforeStart: settings['schedule-event-view-start-hours'] ?? kDefaultEventBoundaryStartHours,
        afterEnd: settings['schedule-event-view-end-hours'] ?? kDefaultEventBoundaryEndHours,
    };
}

/**
 * Loads the `program` slice (areas, locations, activities, and timeslots) for `festivalId`.
 * Returns an empty slice when no AnPlan festival is linked to the event.
 */
export async function loadProgramSlice(festivalId: number | undefined): Promise<ProgramSlice> {
    if (!festivalId) {
        return {
            areas: [],
            locations: [],
            activities: [],
            timeslots: [],
        };
    }

    const dbInstance = db;

    const [ areas, locations, activities, rawTimeslots ] = await Promise.all([
        dbInstance.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaFestivalId.equals(festivalId))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .select({
                id: tActivitiesAreas.areaId,
                name: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
                type: tActivitiesAreas.areaType,
            })
            .executeSelectMany(),

        dbInstance.selectFrom(tActivitiesLocations)
            .where(tActivitiesLocations.locationFestivalId.equals(festivalId))
                .and(tActivitiesLocations.locationDeleted.isNull())
            .select({
                id: tActivitiesLocations.locationId,
                areaId: tActivitiesLocations.locationAreaId,
                name: tActivitiesLocations.locationDisplayName.valueWhenNull(
                    tActivitiesLocations.locationName),
                type: tActivitiesLocations.locationType,
            })
            .executeSelectMany(),

        dbInstance.selectFrom(tActivities)
            .where(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityDeleted.isNull())
            .select({
                id: tActivities.activityId,
                title: tActivities.activityTitle,
                type: tActivities.activityType,
                visible: tActivities.activityVisible.equals(/* true= */ 1),
                locationId: tActivities.activityLocationId,
            })
            .executeSelectMany(),

        dbInstance.selectFrom(tActivitiesTimeslots)
            .innerJoin(tActivities)
                .on(tActivities.activityId.equals(tActivitiesTimeslots.activityId))
                    .and(tActivities.activityFestivalId.equals(festivalId))
                    .and(tActivities.activityDeleted.isNull())
            .where(tActivitiesTimeslots.timeslotDeleted.isNull())
            .select({
                id: tActivitiesTimeslots.timeslotId,
                activityId: tActivitiesTimeslots.activityId,
                locationId: tActivitiesTimeslots.timeslotLocationId,
                start: tActivitiesTimeslots.timeslotStartTime,
                end: tActivitiesTimeslots.timeslotEndTime,
            })
            .executeSelectMany(),
    ]);

    return {
        areas,
        locations,
        activities,
        timeslots: rawTimeslots.map(slot => ({
            id: slot.id,
            activityId: slot.activityId,
            locationId: slot.locationId,
            startMs: slot.start.epochMilliseconds,
            endMs: slot.end.epochMilliseconds,
        })),
    };
}

/**
 * Loads the `teams` slice (enabled teams for `eventId` and all roles).
 */
export async function loadTeamsSlice(eventId: number): Promise<TeamsSlice> {
    const dbInstance = db;

    const [ teams, roles, visibilityRows ] = await Promise.all([
        dbInstance.selectFrom(tEventsTeams)
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tEventsTeams.teamId))
                    .and(tTeams.teamDeleted.isNull())
            .where(tEventsTeams.eventId.equals(eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
            .select({
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
                name: tTeams.teamName,
                title: tTeams.teamTitle,
                colourLight: tTeams.teamColourLightTheme,
                colourDark: tTeams.teamColourDarkTheme,
                enableDutyBook: tTeams.teamFlagEnableDutyBook.equals(/* true= */ 1),
                enableScheduling: tTeams.teamFlagEnableScheduling.equals(/* true= */ 1),
            })
            .executeSelectMany(),

        dbInstance.selectFrom(tRoles)
            .select({
                id: tRoles.roleId,
                name: tRoles.roleName,
                order: tRoles.roleOrder,
                isLeader: tRoles.rolePermissionGrant.isNotNull(),
            })
            .executeSelectMany(),

        dbInstance.selectFrom(tTeamsVisibility)
            .select({
                teamId: tTeamsVisibility.teamId,
                visibleTeamId: tTeamsVisibility.visibleTeamId,
            })
            .executeSelectMany(),
    ]);

    const teamVisibility = new Map<number, Set<number>>();
    for (const row of visibilityRows) {
        let targets = teamVisibility.get(row.teamId);
        if (!targets) {
            targets = new Set();
            teamVisibility.set(row.teamId, targets);
        }
        targets.add(row.visibleTeamId);
    }

    return { teams, roles, teamVisibility };
}

/**
 * Shared query loading accepted volunteer rows and availability preferences for `eventId`,
 * optionally scoped to a single `userId`.
 */
async function queryVolunteerRows(eventId: number, userId?: number): Promise<RawVolunteerRecord[]> {
    const availabilityJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();
    const storageJoin = tStorage.forUseInLeftJoin();

    const rows = await db.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .leftJoin(availabilityJoin)
            .on(availabilityJoin.userId.equals(tUsersEvents.userId))
                .and(availabilityJoin.eventId.equals(tUsersEvents.eventId))
                .and(availabilityJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
        .where(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(tUsersEvents.userId.equalsIfValue(userId))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.firstName,
            displayName: tUsers.displayName,
            avatarHash: storageJoin.fileHash,
            phoneNumber: tUsers.phoneNumber,

            teamId: tUsersEvents.teamId,
            roleId: tUsersEvents.roleId,
            notes: tUsersEvents.registrationNotes,

            preferenceTimingStart: availabilityJoin.availabilityTimingStart,
            preferenceTimingEnd: availabilityJoin.availabilityTimingEnd,
            availabilityExceptions: availabilityJoin.availabilityExceptions,
            availabilityTimeslots: availabilityJoin.availabilityTimeslots,
        })
        .executeSelectMany();

    const byUserId = new Map<number, {
        record: Omit<RawVolunteerRecord, 'participations'>;
        participations: Map<number, EventVolunteerParticipation>;
    }>();

    for (const row of rows) {
        let entry = byUserId.get(row.id);
        if (!entry) {
            entry = {
                record: {
                    id: row.id,
                    name: row.name,
                    firstName: row.firstName,
                    displayName: row.displayName,
                    avatar: getBlobUrl(row.avatarHash),
                    phoneNumber: row.phoneNumber,
                    availability: {
                        preferenceTimingStart: row.preferenceTimingStart,
                        preferenceTimingEnd: row.preferenceTimingEnd,
                        exceptions: parseAvailabilityExceptions(row.availabilityExceptions),
                        requestedTimeslotIds: parseRequestedTimeslotIds(row.availabilityTimeslots),
                    },
                },
                participations: new Map(),
            };
            byUserId.set(row.id, entry);
        }

        if (!entry.participations.has(row.teamId)) {
            entry.participations.set(row.teamId, {
                teamId: row.teamId,
                roleId: row.roleId,
                notes: row.notes,
            });
        }
    }

    const volunteers: RawVolunteerRecord[] = [];
    for (const { record, participations } of byUserId.values()) {
        volunteers.push({
            ...record,
            participations: [ ...participations.values() ],
        });
    }

    return volunteers;
}

/**
 * Loads the `volunteers` slice (all accepted volunteers and their availability preferences) for
 * `eventId`.
 */
export async function loadVolunteersSlice(eventId: number): Promise<VolunteersSlice> {
    const volunteers = await queryVolunteerRows(eventId);
    return { volunteers };
}

/**
 * Loads a single accepted volunteer record for surgical invalidation, returning `undefined` when
 * the volunteer is no longer accepted in `eventId`.
 */
export async function loadSingleVolunteer(
    eventId: number, userId: number): Promise<RawVolunteerRecord | undefined>
{
    const volunteers = await queryVolunteerRows(eventId, userId);
    return volunteers[0];
}

/**
 * Loads the `shifts` slice (active shifts and their categories) for `eventId`.
 */
export async function loadShiftsSlice(eventId: number): Promise<ShiftsSlice> {
    const shifts = await db.selectFrom(tShifts)
        .innerJoin(tShiftsCategories)
            .on(tShiftsCategories.shiftCategoryId.equals(tShifts.shiftCategoryId))
        .where(tShifts.eventId.equals(eventId))
            .and(tShifts.shiftDeleted.isNull())
        .select({
            id: tShifts.shiftId,
            teamId: tShifts.teamId,
            categoryId: tShifts.shiftCategoryId,
            categoryName: tShiftsCategories.shiftCategoryName,
            countsContribution: tShiftsCategories.shiftCategoryCountContribution.equals(1),
            name: tShifts.shiftName,
            description: tShifts.shiftDescription,
            colour: tShifts.shiftColour,
            excitement: tShifts.shiftExcitement,
            activityId: tShifts.shiftActivityId,
            locationId: tShifts.shiftLocationId,
        })
        .executeSelectMany();

    return { shifts };
}

/**
 * Loads the `schedule` slice (non-deleted scheduled shift assignments) for `eventId`.
 */
export async function loadScheduleSlice(eventId: number): Promise<ScheduleSlice> {
    const rows = await db.selectFrom(tSchedule)
        .where(tSchedule.eventId.equals(eventId))
            .and(tSchedule.shiftId.isNotNull())
            .and(tSchedule.scheduleDeleted.isNull())
        .select({
            id: tSchedule.scheduleId,
            shiftId: tSchedule.shiftId,
            userId: tSchedule.userId,
            start: tSchedule.scheduleTimeStart,
            end: tSchedule.scheduleTimeEnd,
        })
        .executeSelectMany();

    return {
        assignments: rows.map(row => ({
            id: row.id,
            shiftId: row.shiftId!,
            userId: row.userId,
            startMs: row.start.epochMilliseconds,
            endMs: row.end.epochMilliseconds,
        })),
    };
}
