// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import type { NavigationArea } from '../navigationTypes';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations,
    tActivitiesTimeslots } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Scope filter supported by `loadCachedProgramTimeslots()`.
 */
type ProgramTimeslotScope = 'activity' | 'area' | 'location';

/**
 * Serializable program timeslot row stored inside `'use cache'` before timezone conversion.
 */
interface CachedProgramTimeslot {
    activityId: number;
    areaName: string;
    end: string;
    hidden: boolean;
    locationId: number;
    locationName: string;
    start: string;
    timeslotId: number;
    title: string;
}

/**
 * Cached epoch-millisecond bounds for a single program timeslot used to count active events.
 */
interface ProgramAreaTimeslotWindow {
    endMs: number;
    startMs: number;
}

/**
 * Program area summary with its alphabetically sorted location names and cached timeslot bounds.
 */
interface ProgramAreaWithLocations {
    id: number;
    locations: string[];
    name: string;
    timeslots: ProgramAreaTimeslotWindow[];
}

/**
 * Parses a positive integer route parameter when `festivalId` is configured.
 */
function parseFestivalEntityId(
    festivalId: number | undefined, param: string): number | undefined
{
    const id = Number(param);
    return festivalId && Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Converts cached ISO instant bounds on `row` to `Temporal.ZonedDateTime` values in `timeZone`.
 */
function toZonedTimeslotBounds(row: CachedProgramTimeslot, timeZone: string) {
    return {
        end: Temporal.Instant.from(row.end).toZonedDateTimeISO(timeZone),
        start: Temporal.Instant.from(row.start).toZonedDateTimeISO(timeZone),
    };
}

/**
 * Shared base query joining active program activities, timeslots, locations, and areas for
 * `festivalId`.
 */
function selectProgramTimeslots(festivalId: number) {
    return db.selectFrom(tActivities)
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
            .and(tActivities.activityDeleted.isNull());
}

/**
 * Loads all program areas for `festivalId` that have at least one scheduled timeslot, sorted
 * alphabetically by display name.
 */
export async function getProgramAreas(festivalId: number): Promise<NavigationArea[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    const rows = await selectProgramTimeslots(festivalId)
        .select({
            id: tActivitiesAreas.areaId,
            name: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
        })
        .groupBy(tActivitiesAreas.areaId)
        .executeSelectMany();

    return rows.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

/**
 * Loads all program areas for `festivalId` along with their alphabetically sorted location names
 * and cached timeslot bounds for counting active events.
 */
export async function getProgramAreasWithLocations(
    festivalId: number): Promise<ProgramAreaWithLocations[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    const rows = await selectProgramTimeslots(festivalId)
        .select({
            areaId: tActivitiesAreas.areaId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            end: tActivitiesTimeslots.timeslotEndTime,
            locationId: tActivitiesLocations.locationId,
            locationName: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
            start: tActivitiesTimeslots.timeslotStartTime,
        })
        .executeSelectMany();

    const areaMap = new Map<number, {
        id: number;
        locations: Map<number, string>;
        name: string;
        timeslots: ProgramAreaTimeslotWindow[];
    }>();

    for (const row of rows) {
        let area = areaMap.get(row.areaId);
        if (!area) {
            area = { id: row.areaId, locations: new Map(), name: row.areaName, timeslots: [] };
            areaMap.set(row.areaId, area);
        }

        area.locations.set(row.locationId, row.locationName);
        area.timeslots.push({
            endMs: row.end.epochMilliseconds,
            startMs: row.start.epochMilliseconds,
        });
    }

    return [ ...areaMap.values() ]
        .map(area => ({
            id: area.id,
            locations: [ ...area.locations.values() ].sort((lhs, rhs) => lhs.localeCompare(rhs)),
            name: area.name,
            timeslots: area.timeslots,
        }))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

/**
 * Loads cached program timeslots for a given `scope` and `id` in `festivalId` with ISO instant
 * timestamps.
 */
async function loadCachedProgramTimeslots(
    festivalId: number, scope: ProgramTimeslotScope, id: number): Promise<CachedProgramTimeslot[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    let query = selectProgramTimeslots(festivalId);
    switch (scope) {
        case 'activity':
            query = query.and(tActivities.activityId.equals(id));
            break;
        case 'area':
            query = query.and(tActivitiesAreas.areaId.equals(id));
            break;
        case 'location':
            query = query.and(tActivitiesLocations.locationId.equals(id));
            break;
    }

    const rows = await query
        .select({
            activityId: tActivities.activityId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            end: tActivitiesTimeslots.timeslotEndTime,
            hidden: tActivities.activityVisible.equals(/* false= */ 0),
            locationId: tActivitiesLocations.locationId,
            locationName: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
            start: tActivitiesTimeslots.timeslotStartTime,
            timeslotId: tActivitiesTimeslots.timeslotId,
            title: tActivities.activityTitle,
        })
        .executeSelectMany();

    return rows.map(row => ({
        ...row,
        end: row.end.toInstant().toString(),
        start: row.start.toInstant().toString(),
    }));
}

/**
 * Request-cached loader fetching all scheduled program timeslots for `areaParam` in `festivalId`
 * with timestamps converted to `timeZone`.
 */
export const getProgramAreaDetail = cache(
    async (festivalId: number | undefined, areaParam: string, timeZone: string) => {
        const areaId = parseFestivalEntityId(festivalId, areaParam);
        if (!areaId)
            return undefined;

        const rows = await loadCachedProgramTimeslots(festivalId!, 'area', areaId);
        if (!rows.length)
            return undefined;

        return {
            locationCount: new Set(rows.map(row => row.locationId)).size,
            name: rows[0].areaName,
            rows: rows.map(row => ({
                activityId: row.activityId,
                hidden: row.hidden,
                locationId: row.locationId,
                locationName: row.locationName,
                timeslotId: row.timeslotId,
                title: row.title,
                ...toZonedTimeslotBounds(row, timeZone),
            })),
        };
    });

/**
 * Request-cached loader fetching all scheduled program timeslots for `locationParam` in
 * `festivalId` with timestamps converted to `timeZone`.
 */
export const getProgramLocationDetail = cache(
    async (festivalId: number | undefined, locationParam: string, timeZone: string) => {
        const locationId = parseFestivalEntityId(festivalId, locationParam);
        if (!locationId)
            return undefined;

        const rows = await loadCachedProgramTimeslots(festivalId!, 'location', locationId);
        if (!rows.length)
            return undefined;

        return {
            areaName: rows[0].areaName,
            name: rows[0].locationName,
            rows: rows.map(row => ({
                activityId: row.activityId,
                hidden: row.hidden,
                timeslotId: row.timeslotId,
                title: row.title,
                ...toZonedTimeslotBounds(row, timeZone),
            })),
        };
    });

/**
 * Request-cached loader fetching program event details and scheduled timeslots for `activityParam`
 * in `festivalId` with timestamps converted to `timeZone`.
 */
export const getProgramEventDetail = cache(
    async (festivalId: number | undefined, activityParam: string, timeZone: string) => {
        const activityId = parseFestivalEntityId(festivalId, activityParam);
        if (!activityId)
            return undefined;

        const rows = await loadCachedProgramTimeslots(festivalId!, 'activity', activityId);
        if (!rows.length)
            return undefined;

        const locationNames = new Set(rows.map(row => row.locationName));
        const location = locationNames.size === 1
            ? rows[0].locationName
            : 'Multiple locations…';

        return {
            activityId,
            location,
            timeslots: rows.map(row => ({
                locationId: row.locationId,
                locationName: row.locationName,
                timeslotId: row.timeslotId,
                ...toZonedTimeslotBounds(row, timeZone),
            })),
            title: rows[0].title,
        };
    });

/**
 * Loads the cached program event title for `activityId` in `festivalId`.
 */
async function loadCachedEventSummary(
    festivalId: number, activityId: number): Promise<string | null>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    return await db.selectFrom(tActivities)
        .where(tActivities.activityFestivalId.equals(festivalId))
            .and(tActivities.activityType.equals(kActivityType.Program))
            .and(tActivities.activityDeleted.isNull())
            .and(tActivities.activityId.equals(activityId))
        .selectOneColumn(tActivities.activityTitle)
        .executeSelectNoneOrOne();
}

/**
 * Request-cached loader fetching the program event title for `activityParam` in `festivalId`.
 */
export const getProgramEventSummary = cache(
    async (festivalId: number | undefined, activityParam: string) => {
        const activityId = parseFestivalEntityId(festivalId, activityParam);
        if (!activityId)
            return undefined;

        const title = await loadCachedEventSummary(festivalId!, activityId);
        return title ? { activityId, title } : undefined;
    });
