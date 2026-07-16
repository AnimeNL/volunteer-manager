// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { headers } from 'next/headers';

import type { PaletteMode } from '@mui/material';

import type { EnvironmentPurpose } from './database/Types';

import { Cache } from '@lib/cache';
import db, { tEnvironments, tTeams } from '@lib/database';

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
     * Unique ID of this environment as it exists in the database.
     */
    id: number;

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
 * Loads the environment configuration from the database, which will then be stored in the cache so
 * that it can be quickly accessed thereafter.
 */
async function loadCachedEnvironmentsFromDatabase() {
    return Cache.getInstance('Environments').getOrInsert(async () => {
        const teamsJoin = tTeams.forUseInLeftJoin();

        const dbInstance = db;
        const environments = await dbInstance.selectFrom(tEnvironments)
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamEnvironmentId.equals(tEnvironments.environmentId))
                    .and(teamsJoin.teamDeleted.isNull())
            .where(tEnvironments.environmentDeleted.isNull())
            .select({
                id: tEnvironments.environmentId,
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

        return environments.map(environment => ({
            ...environment,
            domain: environment.domain as EnvironmentDomain,
        }));
    });
}

/**
 * Determines what the current environment is based on the origin that content is being served from.
 * Will return "undefined" in case no appropriate environment can be found.
 */
export async function determineEnvironment(): Promise<Environment | undefined> {
    const environments = await loadCachedEnvironmentsFromDatabase() || [];
    const requestOrigin =
        /* dev environment= */ process.env.APP_ENVIRONMENT_OVERRIDE ??
        /* production server= */ (await headers()).get('Host');

    for (const environment of environments) {
        if (requestOrigin?.endsWith(environment.domain))
            return environment;
    }

    return undefined;
}
