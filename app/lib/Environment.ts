// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { headers } from 'next/headers';

import type { PaletteMode } from '@mui/material';

import type { EnvironmentPurpose } from './database/Types';
import db, { tEnvironments, tTeams } from '@lib/database';

declare namespace globalThis {
    let animeConEnvironmentCache: Map<string, Environment> | undefined;
}

/**
 * Type to narrow the domain of an environment, which must have a TLD.
 */
export type EnvironmentDomain = `${string}.${string}`;

/**
 * Describes the environment in which the Volunteer Manager has been loaded, as determined by its
 * domain name. The environment contains basic display information, and hosts any number of teams.
 *
 * The AnimeCon Volunteer Manager is a multi-tenant system that hosts individual portals for certain
 * teams, or groups of teams, as it's important for some groups to either maintain their identity,
 * or maintain separation from other groups for organsiational reasons.
 */
export interface Environment {
    /**
     * Theme colours assigned to the environment, which decide the manager's appearance.
     */
    colours: { [key in PaletteMode]: string };

    /**
     * Description of the environment representing its purpose in slightly more words than its
     * title. Will be presented to visitors on the landing page.
     */
    description: string;

    /**
     * Domain name (e.g. "animecon.team") that represents this environment.
     */
    domain: EnvironmentDomain;

    /**
     * Purpose that the environment fulfils, i.e. what should happen when you visit the domain?
     */
    purpose: EnvironmentPurpose;

    /**
     * URL-safe slugs of the teams that are hosted by this environment. Any number (0-...) is valid.
     */
    teams: string[];

    /**
     * Title of the environment (e.g. "Volunteering Crew") representing its purpose.
     */
    title: string;
}

/**
 * Loads the environment configuration from the database, which will then be stored in the cache
 * (`kEnvironmentCache`) so that it can be quickly accessed thereafter.
 *
 * Environment configuration exists exclusively in the database. Adding a new environment is as easy
 * as creating a new row in the `teams` table and ensuring that the domain in the `team_environment`
 * column ends up with the Volunteer Manager.
 *
 * The cache will have to be cleared after changing team configuration or colour settings. This will
 * be done automatically in the applicable API calls (e.g. //api/admin/update-team), but may have
 * to be triggered manually when changing the database directly.
 */
async function loadEnvironmentsFromDatabase(): Promise<void> {
    const teamsJoin = tTeams.forUseInLeftJoin();

    const dbInstance = db;
    const environments = await dbInstance.selectFrom(tEnvironments)
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamEnvironmentId.equals(tEnvironments.environmentId))
                .and(teamsJoin.teamDeleted.isNull())
        .where(tEnvironments.environmentDeleted.isNull())
        .select({
            colours: {
                dark: tEnvironments.environmentColourDarkMode,
                light: tEnvironments.environmentColourLightMode,
            },
            description: tEnvironments.environmentDescription,
            domain: tEnvironments.environmentDomain,
            purpose: tEnvironments.environmentPurpose,
            teams: dbInstance.aggregateAsArrayOfOneColumn(teamsJoin.teamSlug),
            title: tEnvironments.environmentTitle,
        })
        .groupBy(tEnvironments.environmentId)
        .executeSelectMany();

    globalThis.animeConEnvironmentCache = new Map();
    for (const environment of environments) {
        globalThis.animeConEnvironmentCache.set(environment.domain, {
            ...environment,
            domain: environment.domain as EnvironmentDomain,
        });
    }
}

/**
 * Determines what the current environment is based on the origin that content is being served from.
 * Will return "undefined" in case no appropriate environment can be found.
 */
export async function determineEnvironment(): Promise<Environment | undefined> {
    if (!globalThis.animeConEnvironmentCache)
        await loadEnvironmentsFromDatabase();

    const requestOrigin =
        /* dev environment= */   process.env.APP_ENVIRONMENT_OVERRIDE ??
        /* production server= */ (await headers()).get('Host');

    for (const [ environmentName, environment ] of globalThis.animeConEnvironmentCache!.entries()) {
        if (requestOrigin?.endsWith(environmentName))
            return environment;
    }

    return undefined;
}

/**
 * Clears the environment cache. Should be called when environment settings have been updated, as
 * the cached configuration will no longer be valid after that has happened.
 */
export function clearEnvironmentCache() {
    globalThis.animeConEnvironmentCache = undefined;
}
