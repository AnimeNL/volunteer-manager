// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { Cache, invalidateTeamCache } from '@lib/cache';
import { clearPageMetadataCache } from '@app/admin/lib/generatePageMetadata';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { nanoid } from '@lib/nanoid';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEnvironments, tTeams, tTeamsRoles } from '@lib/database';

import { kEnvironmentPurpose } from '@lib/database/Types';

/**
 * Utility function that generates a team's key, used for invitations. These have a fixed size, and
 * should be generated from a cryptographically secure PRNG.
 */
function generateTeamKey(): string {
    return nanoid(/* size= */ 16);
}

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Zod type that describes information required in order to create a new environment.
 */
const kCreateEnvironmentData = z.object({
    domain: z.string().nonempty(),
});

/**
 * Server action that creates a new environment in the Volunteer Manager.
 */
export async function createEnvironment(formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateEnvironmentData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.environments',
            operation: 'create',
        });

        const existingEnvironment = await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentDomain.equals(data.domain))
                .and(tEnvironments.environmentDeleted.isNull())
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!existingEnvironment)
            return { success: false, error: 'An environment with that domain already exists…' };

        const environmentId = await db.insertInto(tEnvironments)
            .set({
                environmentColourDarkMode: '#ff0000',
                environmentColourLightMode: '#ff0000',
                environmentDescription: data.domain,
                environmentDomain: data.domain,
                environmentPurpose: kEnvironmentPurpose.Placeholder,
                environmentTitle: data.domain,
            })
            .returningLastInsertedId()
            .executeInsert();

        if (!environmentId)
            return { success: false, error: 'Unable to store the environment in the database…' };

        LogBuilder.for('CreateEnvironment')
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                domain: data.domain,
            });

        Cache.getInstance('Environments').clear();

        return {
            success: true,
            redirect: `/admin/organisation/structure/environments/${data.domain}`,
        };
    });
}

/**
 * Zod type that describes information required in order to create a new team.
 */
const kCreateTeamData = z.object({
    environment: z.number(),
    name: z.string().nonempty(),
    plural: z.string().nonempty(),
    slug: z.string().nonempty(),
    title: z.string().nonempty(),
});

/**
 * Server action that creates a new team in the Volunteer Manager.
 */
export async function createTeam(formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateTeamData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.teams',
            operation: 'create',
        });

        const existingEnvironment = await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentId.equals(data.environment))
                .and(tEnvironments.environmentDeleted.isNull())
            .selectOneColumn(tEnvironments.environmentDomain)
            .executeSelectNoneOrOne();

        if (!existingEnvironment)
            return { success: false, error: 'The given environment could not be found…' };

        const existingTeam = await db.selectFrom(tTeams)
            .where(tTeams.teamSlug.equals(data.slug))
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!existingTeam)
            return { success: false, error: 'A team with that slug already exists…' };

        const defaultEmailAccountId =
            await readSetting('integration-email-default-account-id') ?? 1;

        const teamId = await db.insertInto(tTeams)
            .set({
                teamSlug: data.slug,
                teamName: data.name,
                teamPlural: data.plural,
                teamTitle: data.title,
                teamDescription: data.title,
                teamEnvironment: existingEnvironment,
                teamEnvironmentId: data.environment,
                teamInviteKey: generateTeamKey(),
                teamEmailAccountId: defaultEmailAccountId,
                teamColourDarkTheme: '#ff0000',
                teamColourLightTheme: '#ff0000',
            })
            .returningLastInsertedId()
            .executeInsert();

        if (!teamId)
            return { success: false, error: 'Unable to store the new team in the database…' };

        // Set the default role for this team. Without this row created, it's not possible for
        // volunteers to be allocated to the team. The default role is "Crew", our generic crew
        // member role.
        {
            await db.insertInto(tTeamsRoles)
                .set({
                    teamId,
                    roleId: /* Crew= */ 1,
                    roleDefault: /* true= */ 1,
                })
                .executeInsert();
        }

        await invalidateTeamCache(data.slug);

        LogBuilder.for('CreateTeam')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                team: data.title,
            });

        Cache.getInstance('Environments').clear();

        return {
            success: true,
            redirect: `/admin/organisation/structure/${data.slug}`,
        };
    });
}

/**
 * Server action that deletes the environment identified by the given `environmentId`.
 */
export async function deleteEnvironment(environmentId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.environments',
            operation: 'delete',
        });

        const existingEnvironment = await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentId.equals(environmentId))
                .and(tEnvironments.environmentDeleted.isNull())
            .selectOneColumn(tEnvironments.environmentDomain)
            .executeSelectNoneOrOne();

        if (!existingEnvironment)
            return { success: false, error: 'The given environment could not be found…' };

        const dbInstance = db;
        const affectedRows = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.update(tEnvironments)
                .set({
                    environmentDeleted: dbInstance.currentZonedDateTime()
                })
                .where(tEnvironments.environmentId.equals(environmentId))
                    .and(tEnvironments.environmentDeleted.isNull())
                .executeUpdate();

            await dbInstance.update(tTeams)
                .set({
                    teamEnvironmentId: null
                })
                .where(tTeams.teamEnvironmentId.equals(environmentId))
                .executeUpdate();

            return affectedRows;
        });

        if (!affectedRows)
            return { success: false, error: 'Unable to remove the environment from the database…' };

        LogBuilder.for('DeleteEnvironment')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                domain: existingEnvironment,
            });

        Cache.getInstance('Environments').clear();

        clearPageMetadataCache('environment');

        return {
            success: true,
            redirect: '/admin/organisation/structure/environments',
        };
    });
}

/**
 * Server action that regenerates a team's invite key.
 */
export async function resetTeamKey(teamId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.teams',
            operation: 'update',
        });

        const dbInstance = db;
        const teamName = await dbInstance.selectFrom(tTeams)
            .where(tTeams.teamId.equals(teamId))
            .selectOneColumn(tTeams.teamName)
            .executeSelectNoneOrOne();

        if (!teamName)
            notFound();

        const affectedRows = await db.update(tTeams)
            .set({
                teamInviteKey: generateTeamKey(),
            })
            .where(tTeams.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the newly generated key…' };

        await invalidateTeamCache(teamId);

        LogBuilder.for('ResetTeamKey')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                team: teamName,
            });

        return { success: true };
    });
}

/**
 * Server action that either disables or enables the team identified by the given `teamId`.
 */
export async function toggleTeamEnabled(teamId: number, enabled: boolean, formData: unknown) {
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.teams',
            operation: 'update',
        });

        const dbInstance = db;
        const existingTeam = await dbInstance.selectFrom(tTeams)
            .where(tTeams.teamId.equals(teamId))
            .select({
                enabled: tTeams.teamDeleted.isNull(),
                title: tTeams.teamTitle,
            })
            .executeSelectNoneOrOne();

        if (!existingTeam)
            return { success: false, error: 'The given team could not be found…' };

        if (existingTeam.enabled === enabled)
            return { success: true, refresh: true };  // status quo is maintained

        const affectedRows = await db.update(tTeams)
            .set({
                teamDeleted: enabled ? null : dbInstance.currentZonedDateTime(),
            })
            .where(tTeams.teamId.equals(teamId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to update the team state in the database…' };

        await invalidateTeamCache(teamId);

        LogBuilder.for('UpdateTeamEnabled')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                action: enabled ? 'Enabled' : 'Disabled',
                team: existingTeam.title,
            });

        return {
            success: true,
            refresh: true,
        };
    });
}

/**
 * Zod type that describes information required in order to update an environment.
 */
const kUpdateEnvironmentData = z.object({
    colorDarkMode: z.string().regex(/^#([0-9a-f]){6}$/i),
    colorLightMode: z.string().regex(/^#([0-9a-f]){6}$/i),
    description: z.string().nonempty(),
    // domain is deliberately omitted
    purpose: z.enum(kEnvironmentPurpose),
    title: z.string().nonempty(),
});

/**
 * Server action that updates environment information for the one identified by the given `userId`.
 */
export async function updateEnvironment(environmentId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateEnvironmentData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.environments',
            operation: 'update',
        });

        const existingEnvironment = await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentId.equals(environmentId))
                .and(tEnvironments.environmentDeleted.isNull())
            .selectOneColumn(tEnvironments.environmentDomain)
            .executeSelectNoneOrOne();

        if (!existingEnvironment)
            notFound();

        const affectedRows = await db.update(tEnvironments)
            .set({
                environmentColourDarkMode: data.colorDarkMode,
                environmentColourLightMode: data.colorLightMode,
                environmentDescription: data.description,
                environmentPurpose: data.purpose,
                environmentTitle: data.title,
            })
            .where(tEnvironments.environmentId.equals(environmentId))
                .and(tEnvironments.environmentDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateEnvironment')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                domain: existingEnvironment,
            });

        Cache.getInstance('Environments').clear();

        clearPageMetadataCache('environment');

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes information required in order to update a team.
 */
const kUpdateTeamData = z.object({
    colorDarkMode: z.string().regex(/^#([0-9a-f]){6}$/i),
    colorLightMode: z.string().regex(/^#([0-9a-f]){6}$/i),
    description: z.string().nonempty(),
    department: z.string().optional(),
    environment: z.number(),
    name: z.string().nonempty(),
    plural: z.string().nonempty(),
    // slug is deliberately omitted
    title: z.string().nonempty(),
    emailAccountId: z.number(),

    defaultRoleId: z.number(),
    availableRoleIds: z.array(z.number()),

    flagEnableDutyBook: z.boolean(),
    flagEnableScheduling: z.boolean(),
    flagGrowthCharts: z.boolean(),
    flagManagesContent: z.boolean(),
    flagManagesFaq: z.boolean(),
    flagManagesFirstAid: z.boolean(),
    flagManagesSecurity: z.boolean(),
    flagProgramRequests: z.boolean(),
    flagRequestConfirmation: z.boolean(),
});

/**
 * Server action that updates team information for the one identified by the given `teamId`.
 */
export async function updateTeam(teamId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateTeamData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, {
            permission: 'organisation.teams',
            operation: 'update',
        });

        if (!data.availableRoleIds.length)
            return { success: false, error: 'The team must have at least one available role…' };
        if (!data.availableRoleIds.includes(data.defaultRoleId))
            return { success: false, error: 'The default role of this team must be available…' };

        const dbInstance = db;
        const affectedRows = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.update(tTeams)
                .set({
                    teamColourDarkTheme: data.colorDarkMode,
                    teamColourLightTheme: data.colorLightMode,
                    teamDescription: data.description,
                    teamDepartment: !!data.department?.length ? data.department : null,
                    teamEnvironmentId: data.environment,
                    teamName: data.name,
                    teamPlural: data.plural,
                    teamTitle: data.title,
                    teamEmailAccountId: data.emailAccountId,

                    teamFlagEnableDutyBook: !!data.flagEnableDutyBook ? 1 : 0,
                    teamFlagEnableScheduling: !!data.flagEnableScheduling ? 1 : 0,
                    teamFlagGrowthCharts: !!data.flagGrowthCharts ? 1 : 0,
                    teamFlagManagesContent: !!data.flagManagesContent ? 1 : 0,
                    teamFlagManagesFaq: !!data.flagManagesFaq ? 1 : 0,
                    teamFlagManagesFirstAid: !!data.flagManagesFirstAid ? 1 : 0,
                    teamFlagManagesSecurity: !!data.flagManagesSecurity ? 1 : 0,
                    teamFlagProgramRequests: !!data.flagProgramRequests ? 1 : 0,
                    teamFlagRequestConfirmation: !!data.flagRequestConfirmation ? 1 : 0,
                })
                .where(tTeams.teamId.equals(teamId))
                .executeUpdate();

            await dbInstance.deleteFrom(tTeamsRoles)
                .where(tTeamsRoles.teamId.equals(teamId))
                .executeDelete();

            await dbInstance.insertInto(tTeamsRoles)
                .values(data.availableRoleIds.map(roleId => ({
                    teamId,
                    roleId,
                    roleDefault: data.defaultRoleId === roleId ? 1 : 0,
                })))
                .executeInsert();

            return affectedRows;
        });

        if (!affectedRows)
            return { success: false, error: 'Unable to update the team in the database…' };

        Cache.getInstance('Environments').clear();

        await invalidateTeamCache(teamId);

        LogBuilder.for('UpdateTeam')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                team: data.title,
            });

        return { success: true, refresh: true };
    });
}
