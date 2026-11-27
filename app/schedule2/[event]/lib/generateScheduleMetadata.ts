// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { cacheLife, cacheTag } from 'next/cache';

import { parseVendorTeam } from './vendorMetadata';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tContentCategories, tEvents,
    tTeams } from '@lib/database';

import { kVendorMetadata } from './vendorMetadata';

/**
 * Fallback application title appended when an event short name cannot be resolved.
 */
const kFallbackEventName = 'AnimeCon';

/**
 * Parses a numeric entity identifier from a route parameter, returning `undefined` if invalid.
 */
function parsePositiveId(value: string): number | undefined {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Loads the cached short name for an event identified by `slug`.
 */
async function resolveEventName(slug: string): Promise<string | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-metadata', `schedule-metadata:event:${slug}`);

    if (process.env.NEXT_PHASE === 'phase-production-build')
        return null;

    return await db.selectFrom(tEvents)
        .where(tEvents.eventSlug.equals(slug))
        .selectOneColumn(tEvents.eventShortName)
        .executeSelectNoneOrOne();
}

/**
 * Loads the cached display name for a program area identified by `value`.
 */
async function resolveAreaName(value: string): Promise<string | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-metadata:area:${value}`);

    const areaId = parsePositiveId(value);
    if (!areaId || process.env.NEXT_PHASE === 'phase-production-build')
        return null;

    return await db.selectFrom(tActivitiesAreas)
        .where(tActivitiesAreas.areaId.equals(areaId))
            .and(tActivitiesAreas.areaDeleted.isNull())
        .selectOneColumn(tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName))
        .executeSelectNoneOrOne();
}

/**
 * Loads the cached display name for a program location identified by `value`.
 */
async function resolveLocationName(value: string): Promise<string | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-metadata:location:${value}`);

    const locationId = parsePositiveId(value);
    if (!locationId || process.env.NEXT_PHASE === 'phase-production-build')
        return null;

    return await db.selectFrom(tActivitiesLocations)
        .where(tActivitiesLocations.locationId.equals(locationId))
            .and(tActivitiesLocations.locationDeleted.isNull())
        .selectOneColumn(
            tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName))
        .executeSelectNoneOrOne();
}

/**
 * Loads the cached title for a program activity identified by `value`.
 */
async function resolveActivityTitle(value: string): Promise<string | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-metadata:activity:${value}`);

    const activityId = parsePositiveId(value);
    if (!activityId || process.env.NEXT_PHASE === 'phase-production-build')
        return null;

    return await db.selectFrom(tActivities)
        .where(tActivities.activityId.equals(activityId))
            .and(tActivities.activityDeleted.isNull())
        .selectOneColumn(tActivities.activityTitle)
        .executeSelectNoneOrOne();
}

/**
 * Loads the cached title for a Knowledge Base category identified by `value`.
 */
async function resolveCategoryTitle(value: string): Promise<string | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-knowledge', `schedule-metadata:category:${value}`);

    const categoryId = parsePositiveId(value);
    if (!categoryId || process.env.NEXT_PHASE === 'phase-production-build')
        return null;

    return await db.selectFrom(tContentCategories)
        .where(tContentCategories.categoryId.equals(categoryId))
            .and(tContentCategories.categoryDeleted.isNull())
        .selectOneColumn(tContentCategories.categoryTitle)
        .executeSelectNoneOrOne();
}

/**
 * Loads the cached display name for a team identified by `slug`.
 */
async function resolveTeamName(slug: string): Promise<string | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-duty-book-teams', `schedule-metadata:team:${slug}`);

    if (process.env.NEXT_PHASE === 'phase-production-build')
        return null;

    return await db.selectFrom(tTeams)
        .where(tTeams.teamSlug.equals(slug))
            .and(tTeams.teamDeleted.isNull())
        .selectOneColumn(tTeams.teamName)
        .executeSelectNoneOrOne();
}

/**
 * Resolves the human-readable title for a vendor team route parameter.
 */
async function resolveVendorTitle(team: string): Promise<string | null> {
    const vendorTeam = parseVendorTeam(team);
    return vendorTeam ? kVendorMetadata[vendorTeam].title : null;
}

/**
 * Resolvers that obtain a human-readable entity label for schedule portal metadata generation.
 */
const kEntityResolvers = {
    activity: resolveActivityTitle,
    area: resolveAreaName,
    category: resolveCategoryTitle,
    event: resolveEventName,
    location: resolveLocationName,
    team: resolveTeamName,
    vendor: resolveVendorTitle,
} as const;

type EntityType = keyof typeof kEntityResolvers;

type EntityPathValue = {
    [K in EntityType]: { [P in K]: string };
}[EntityType];

type PathValue = string | EntityPathValue;

/**
 * Creates a Next.js `generateMetadata` function for a schedule portal page, modeled on
 * `app/admin/lib/generatePageMetadata.ts`. Entity labels are read through `'use cache'` helpers
 * without exposing sensitive data.
 */
export function createScheduleMetadataFn(...path: PathValue[]) {
    return (props: PageProps<any>) => generateScheduleMetadata(props, path);
}

async function generateScheduleMetadata(
    props: PageProps<any>, path: PathValue[]): Promise<Metadata>
{
    let params: Record<string, string | string[] | undefined> | undefined;

    const resolvedPath: string[] = [];
    for (const component of path) {
        if (typeof component === 'string') {
            resolvedPath.push(component);
            continue;
        }

        params ??= await props.params;

        for (const [ key, resolver ] of Object.entries(kEntityResolvers)) {
            const typedKey = key as EntityType;
            if (!(typedKey in component))
                continue;

            const paramName = (component as Record<EntityType, string>)[typedKey];
            const rawValue = params?.[paramName];
            const paramValue = typeof rawValue === 'string' ? rawValue : undefined;
            if (!paramValue)
                break;

            const resolved = await resolver(paramValue);
            if (resolved)
                resolvedPath.push(resolved);
            else if (typedKey === 'event')
                resolvedPath.push(kFallbackEventName);

            break;
        }
    }

    return {
        title: resolvedPath.join(' | ') || kFallbackEventName,
    };
}
