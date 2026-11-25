// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesTimeslots, tSchedule,
    tShifts } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Serializable scheduled shift record returned from the cached shift loader.
 */
interface ScheduledShiftRecord {
    description?: string;
    endEpochMs: number;
    id: number;
    location: string;
    shiftId: number;
    startEpochMs: number;
    title: string;
}

/**
 * Serializable program area record returned from the cached program loader.
 */
interface ProgramAreaRecord {
    id: number;
    locations: { id: number; name: string }[];
    name: string;
    timeslots: { endEpochMs: number; startEpochMs: number }[];
}

/**
 * Loads all scheduled shifts for `userId` in `eventId`, ordered chronologically. Timestamps are
 * returned as epoch milliseconds so the result serializes cleanly across `'use cache'` boundaries.
 */
export async function getUserEventShifts(
    eventId: number, userId: number): Promise<ScheduledShiftRecord[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-shifts', `schedule2-shifts:${eventId}:${userId}`);

    const activityJoin = tActivities.forUseInLeftJoin();
    const activityLocationJoin = tActivitiesLocations.forUseInLeftJoinAs('alj');
    const shiftLocationJoin = tActivitiesLocations.forUseInLeftJoinAs('slj');

    const rows = await db.selectFrom(tSchedule)
        .innerJoin(tShifts)
            .on(tShifts.shiftId.equals(tSchedule.shiftId))
                .and(tShifts.shiftDeleted.isNull())
        .leftJoin(shiftLocationJoin)
            .on(shiftLocationJoin.locationId.equals(tShifts.shiftLocationId))
        .leftJoin(activityJoin)
            .on(activityJoin.activityId.equals(tShifts.shiftActivityId))
        .leftJoin(activityLocationJoin)
            .on(activityLocationJoin.locationId.equals(activityJoin.activityLocationId))
        .where(tSchedule.eventId.equals(eventId))
            .and(tSchedule.userId.equals(userId))
            .and(tSchedule.scheduleDeleted.isNull())
        .select({
            id: tSchedule.scheduleId,
            shiftId: tShifts.shiftId,
            title: tShifts.shiftName,
            description: tShifts.shiftDescription,
            shiftLocation: shiftLocationJoin.locationDisplayName.valueWhenNull(
                shiftLocationJoin.locationName),
            activityLocation: activityLocationJoin.locationDisplayName.valueWhenNull(
                activityLocationJoin.locationName),
            start: tSchedule.scheduleTimeStart,
            end: tSchedule.scheduleTimeEnd,
        })
        .orderBy(tSchedule.scheduleTimeStart, 'asc')
        .executeSelectMany();

    return rows.map(row => ({
        id: row.id,
        shiftId: row.shiftId,
        title: row.title,
        description: row.description ?? undefined,
        location: row.shiftLocation || row.activityLocation || 'Volunteer Lounge',
        startEpochMs: row.start.epochMilliseconds,
        endEpochMs: row.end.epochMilliseconds,
    }));
}

/**
 * Loads all program areas, locations, and timeslot windows for `festivalId`, sorted alphabetically
 * by area name. Callers compute live active counts against the effective portal clock.
 */
export async function getProgramAreas(festivalId: number): Promise<ProgramAreaRecord[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-program', `schedule2-program:${festivalId}`);

    const rows = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
                .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .innerJoin(tActivitiesLocations)
            .on(tActivitiesLocations.locationId.equals(tActivitiesTimeslots.timeslotLocationId))
                .and(tActivitiesLocations.locationDeleted.isNull())
        .innerJoin(tActivitiesAreas)
            .on(tActivitiesAreas.areaId.equals(tActivitiesLocations.locationAreaId))
                .and(tActivitiesAreas.areaDeleted.isNull())
        .where(tActivities.activityFestivalId.equals(festivalId))
            .and(tActivities.activityType.equals(kActivityType.Program))
            .and(tActivities.activityDeleted.isNull())
        .select({
            areaId: tActivitiesAreas.areaId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            locationId: tActivitiesLocations.locationId,
            locationName: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
            start: tActivitiesTimeslots.timeslotStartTime,
            end: tActivitiesTimeslots.timeslotEndTime,
        })
        .executeSelectMany();

    const areas = new Map<number, {
        id: number;
        locationMap: Map<number, string>;
        name: string;
        timeslots: { endEpochMs: number; startEpochMs: number }[];
    }>();

    for (const row of rows) {
        let area = areas.get(row.areaId);
        if (!area) {
            area = {
                id: row.areaId,
                name: row.areaName,
                locationMap: new Map(),
                timeslots: [],
            };
            areas.set(row.areaId, area);
        }

        area.locationMap.set(row.locationId, row.locationName);
        area.timeslots.push({
            startEpochMs: row.start.epochMilliseconds,
            endEpochMs: row.end.epochMilliseconds,
        });
    }

    return [ ...areas.values() ]
        .map(area => ({
            id: area.id,
            name: area.name,
            locations: [ ...area.locationMap.entries() ]
                .map(([ id, name ]) => ({ id, name }))
                .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name)),
            timeslots: area.timeslots,
        }))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}
