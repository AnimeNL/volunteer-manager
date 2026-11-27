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
 * Serializable area timeslot row stored inside `'use cache'` before timezone conversion.
 */
interface CachedAreaTimeslot {
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
 * Serializable location timeslot row stored inside `'use cache'` before timezone conversion.
 */
interface CachedLocationTimeslot {
    activityId: number;
    areaName: string;
    end: string;
    hidden: boolean;
    locationName: string;
    start: string;
    timeslotId: number;
    title: string;
}

/**
 * Serializable event timeslot row stored inside `'use cache'` before timezone conversion.
 */
interface CachedEventTimeslot {
    end: string;
    locationId: number;
    locationName: string;
    start: string;
    timeslotId: number;
    title: string;
}

/**
 * Program area summary with its alphabetically sorted location names.
 */
interface ProgramAreaWithLocations {
    id: number;
    locations: string[];
    name: string;
}

/**
 * Scheduled program timeslot within an area, with bounds converted to the event's timezone.
 */
interface ProgramAreaTimeslot {
    activityId: number;
    end: Temporal.ZonedDateTime;
    hidden: boolean;
    locationId: number;
    locationName: string;
    start: Temporal.ZonedDateTime;
    timeslotId: number;
    title: string;
}

/**
 * Resolved area metadata and scheduled program timeslots for the area detail page.
 */
interface ProgramAreaDetail {
    locationCount: number;
    name: string;
    rows: ProgramAreaTimeslot[];
}

/**
 * Scheduled program timeslot at a location, with bounds converted to the event's timezone.
 */
interface ProgramLocationTimeslot {
    activityId: number;
    end: Temporal.ZonedDateTime;
    hidden: boolean;
    start: Temporal.ZonedDateTime;
    timeslotId: number;
    title: string;
}

/**
 * Resolved location metadata and scheduled program timeslots for the location detail page.
 */
interface ProgramLocationDetail {
    areaName: string;
    name: string;
    rows: ProgramLocationTimeslot[];
}

/**
 * Scheduled timeslot for a program event, with bounds converted to the event's timezone.
 */
interface ProgramEventTimeslot {
    end: Temporal.ZonedDateTime;
    locationId: number;
    locationName: string;
    start: Temporal.ZonedDateTime;
    timeslotId: number;
}

/**
 * Resolved program event metadata and scheduled timeslots for the event detail page.
 */
interface ProgramEventDetail {
    activityId: number;
    location: string;
    timeslots: ProgramEventTimeslot[];
    title: string;
}

/**
 * Minimal program event summary for ticket holder subpages.
 */
interface ProgramEventSummary {
    activityId: number;
    title: string;
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
 * Loads all program areas for `festivalId` along with their alphabetically sorted location names.
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
            locationName: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
        })
        .groupBy(tActivitiesAreas.areaId, tActivitiesLocations.locationId)
        .executeSelectMany();

    const areaMap = new Map<number, ProgramAreaWithLocations>();
    for (const row of rows) {
        let area = areaMap.get(row.areaId);
        if (!area) {
            area = { id: row.areaId, locations: [], name: row.areaName };
            areaMap.set(row.areaId, area);
        }

        area.locations.push(row.locationName);
    }

    return [ ...areaMap.values() ]
        .map(area => ({
            ...area,
            locations: area.locations.sort((lhs, rhs) => lhs.localeCompare(rhs)),
        }))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

/**
 * Loads cached program timeslots for `areaId` in `festivalId` with ISO instant timestamps.
 */
async function loadCachedAreaTimeslots(
    festivalId: number, areaId: number): Promise<CachedAreaTimeslot[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    const rows = await selectProgramTimeslots(festivalId)
        .and(tActivitiesAreas.areaId.equals(areaId))
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
    async (festivalId: number | undefined, areaParam: string, timeZone: string)
        : Promise<ProgramAreaDetail | undefined> =>
    {
        const areaId = Number(areaParam);
        if (!festivalId || !Number.isInteger(areaId))
            return undefined;

        const rows = await loadCachedAreaTimeslots(festivalId, areaId);
        if (!rows.length)
            return undefined;

        return {
            locationCount: new Set(rows.map(row => row.locationId)).size,
            name: rows[0].areaName,
            rows: rows.map(row => ({
                activityId: row.activityId,
                end: Temporal.Instant.from(row.end).toZonedDateTimeISO(timeZone),
                hidden: row.hidden,
                locationId: row.locationId,
                locationName: row.locationName,
                start: Temporal.Instant.from(row.start).toZonedDateTimeISO(timeZone),
                timeslotId: row.timeslotId,
                title: row.title,
            })),
        };
    });

/**
 * Loads cached program timeslots for `locationId` in `festivalId` with ISO instant timestamps.
 */
async function loadCachedLocationTimeslots(
    festivalId: number, locationId: number): Promise<CachedLocationTimeslot[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    const rows = await selectProgramTimeslots(festivalId)
        .and(tActivitiesLocations.locationId.equals(locationId))
        .select({
            activityId: tActivities.activityId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            end: tActivitiesTimeslots.timeslotEndTime,
            hidden: tActivities.activityVisible.equals(/* false= */ 0),
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
 * Request-cached loader fetching all scheduled program timeslots for `locationParam` in
 * `festivalId` with timestamps converted to `timeZone`.
 */
export const getProgramLocationDetail = cache(
    async (festivalId: number | undefined, locationParam: string, timeZone: string)
        : Promise<ProgramLocationDetail | undefined> =>
    {
        const locationId = Number(locationParam);
        if (!festivalId || !Number.isInteger(locationId))
            return undefined;

        const rows = await loadCachedLocationTimeslots(festivalId, locationId);
        if (!rows.length)
            return undefined;

        return {
            areaName: rows[0].areaName,
            name: rows[0].locationName,
            rows: rows.map(row => ({
                activityId: row.activityId,
                end: Temporal.Instant.from(row.end).toZonedDateTimeISO(timeZone),
                hidden: row.hidden,
                start: Temporal.Instant.from(row.start).toZonedDateTimeISO(timeZone),
                timeslotId: row.timeslotId,
                title: row.title,
            })),
        };
    });

/**
 * Loads cached program timeslots for `activityId` in `festivalId` with ISO instant timestamps.
 */
async function loadCachedEventTimeslots(
    festivalId: number, activityId: number): Promise<CachedEventTimeslot[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

    const rows = await selectProgramTimeslots(festivalId)
        .and(tActivities.activityId.equals(activityId))
        .select({
            end: tActivitiesTimeslots.timeslotEndTime,
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
 * Request-cached loader fetching program event details and scheduled timeslots for `activityParam`
 * in `festivalId` with timestamps converted to `timeZone`.
 */
export const getProgramEventDetail = cache(
    async (festivalId: number | undefined, activityParam: string, timeZone: string)
        : Promise<ProgramEventDetail | undefined> =>
    {
        const activityId = Number(activityParam);
        if (!festivalId || !Number.isInteger(activityId))
            return undefined;

        const rows = await loadCachedEventTimeslots(festivalId, activityId);
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
                end: Temporal.Instant.from(row.end).toZonedDateTimeISO(timeZone),
                locationId: row.locationId,
                locationName: row.locationName,
                start: Temporal.Instant.from(row.start).toZonedDateTimeISO(timeZone),
                timeslotId: row.timeslotId,
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
    async (festivalId: number | undefined, activityParam: string)
        : Promise<ProgramEventSummary | undefined> =>
    {
        const activityId = Number(activityParam);
        if (!festivalId || !Number.isInteger(activityId))
            return undefined;

        const title = await loadCachedEventSummary(festivalId, activityId);
        return title ? { activityId, title } : undefined;
    });
