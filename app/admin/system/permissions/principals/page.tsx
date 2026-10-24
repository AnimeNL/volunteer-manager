// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';

import type { AccessDescriptor, AccessOperation } from '@lib/auth/AccessDescriptor';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import type { PrincipalRecord, PrincipalScopeGroup, PrincipalSubgroup, PrincipalUser }
    from './PrincipalsAccordions';
import { AccessControl } from '@lib/auth/AccessControl';
import { PrincipalsAccordion } from './PrincipalsAccordions';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getBlobUrl } from '@lib/database/BlobStore';
import { parseCrudOperations } from '../toPermissionList';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents, tPermissions, tPermissionsRoles, tRoles, tStorage, tTeams, tUsers,
    tUsersEvents } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { kCrudOperations } from '../toPermissionList';
import { kPermissions } from '@lib/auth/Access';
import { kRegistrationStatus } from '@lib/database/Types';
import { kRootRole } from '../Root';

/**
 * Default scope used to query whether a permission is granted for any event and team.
 */
const kAnyScope = {
    event: kAnyEvent,
    team: kAnyTeam,
};

/**
 * Categories under which permissions are grouped on the page.
 */
const kPermissionCategories = [
    { root: 'event', title: 'Events' },
    { root: 'organisation', title: 'Organisation' },
    { root: 'statistics', title: 'Statistics' },
    { root: 'system', title: 'System' },
    { root: 'volunteers', title: 'Volunteers' },
] as const;

/**
 * Represents a user who has active access grants or event roles, ready for inspection.
 */
interface ProcessedUser {
    user: PrincipalUser;
    grants: string[];
    globalAccess: AccessControl;
    hasCustomScope: boolean;
    customScope?: string;
    eventRoles: {
        roleGrant: string;
        event: string;
        eventSlug: string;
        team: string;
    }[];
}

/**
 * Metadata for a permission defined in the system.
 */
interface PermissionDefinition {
    id: string;
    name: string;
    description: string;
    operations: readonly AccessOperation[];
    descriptor: AccessDescriptor;
}

/**
 * Resolved scope entry for a user holding a role or permission.
 */
interface ResolvedUserScope {
    type: 'global' | 'event';
    event?: string;
    eventSlug?: string;
    title?: string;
    operations?: string;
}

/**
 * Checks whether the given permission is granted under the given `access` control instance.
 */
function checkPermissionGranted(
    access: AccessControl, descriptor: AccessDescriptor, permissionName: string): boolean
{
    if (descriptor.type === 'boolean')
        return access.can(permissionName as BooleanPermission, kAnyScope);

    return kCrudOperations.some(op =>
        access.can(permissionName as CRUDPermission, op, kAnyScope));
}

/**
 * Formats partial CRUD operations granted under `access`, or undefined if all (or not CRUD).
 */
function getFormattedOperations(
    access: AccessControl, definition: PermissionDefinition): string | undefined
{
    if (definition.descriptor.type !== 'crud')
        return undefined;

    const ops = definition.operations.filter(op =>
        access.can(definition.id as CRUDPermission, op, kAnyScope));

    if (!ops.length || ops.length >= definition.operations.length)
        return undefined;

    return ops.length === 1 ? `${ops[0]} only` : ops.join(', ');
}

/**
 * Resolves the source description for a globally granted permission.
 */
function resolveGlobalGrantSource(
    grants: string[], definition: PermissionDefinition, dbRoles: { id: string; name: string }[],
    roleAccessMap: Map<string, AccessControl>): string
{
    if (grants.some(g => g === definition.id || g.startsWith(`${definition.id}:`)))
        return 'Direct grant';
    if (grants.includes('root'))
        return 'Root administrator';

    const grantingRole = dbRoles.find(r => {
        if (!grants.includes(r.id))
            return false;

        const roleAccess = roleAccessMap.get(r.id);
        return !!roleAccess &&
            checkPermissionGranted(roleAccess, definition.descriptor, definition.id);
    }) ?? dbRoles.find(r => grants.includes(r.id));

    return grantingRole ? grantingRole.name : 'Global grant';
}

/**
 * Computes resolved scopes for a specific role and user.
 */
function getRoleScopes(user: ProcessedUser, roleId: string): ResolvedUserScope[] {
    if (user.grants.includes(roleId))
        return [ { type: 'global', title: user.customScope } ];

    const hasGlobalSuperRole =
        (user.grants.includes('root') || user.grants.includes('admin')) && !user.hasCustomScope;

    if (hasGlobalSuperRole)
        return [];

    return user.eventRoles
        .filter(e => e.roleGrant === roleId)
        .map(e => ({
            type: 'event',
            event: e.event,
            eventSlug: e.eventSlug,
            title: e.team || 'Unknown team',
        }));
}

/**
 * Computes resolved scopes for a specific permission and user.
 */
function getPermissionScopes(
    user: ProcessedUser,
    definition: PermissionDefinition,
    dbRoles: { id: string; name: string }[],
    roleNameMap: Map<string, string>,
    roleAccessMap: Map<string, AccessControl>
): ResolvedUserScope[] {
    if (checkPermissionGranted(user.globalAccess, definition.descriptor, definition.id)) {
        const source = resolveGlobalGrantSource(user.grants, definition, dbRoles, roleAccessMap);
        return [
            {
                type: 'global',
                title: user.customScope ? `${user.customScope} (${source})` : source,
                operations: getFormattedOperations(user.globalAccess, definition),
            },
        ];
    }

    const scopes: ResolvedUserScope[] = [];
    for (const e of user.eventRoles) {
        let roleAccess = roleAccessMap.get(e.roleGrant);
        if (!roleAccess) {
            roleAccess = new AccessControl({
                grants: e.roleGrant,
                events: kAnyEvent,
                teams: kAnyTeam,
            });
            roleAccessMap.set(e.roleGrant, roleAccess);
        }

        if (checkPermissionGranted(roleAccess, definition.descriptor, definition.id)) {
            const team = e.team || 'Unknown team';
            const source = roleNameMap.get(e.roleGrant) ?? e.roleGrant;

            scopes.push({
                type: 'event',
                event: e.event,
                eventSlug: e.eventSlug,
                title: source && source !== team ? `${team} (${source})` : team,
                operations: getFormattedOperations(roleAccess, definition),
            });
        }
    }

    return scopes;
}

/**
 * Builds a `PrincipalRecord` by grouping matching users hierarchically by scope and subgroup.
 * Assumes `users` is already sorted alphabetically by user name.
 */
function buildPrincipalRecord(
    id: string,
    name: string,
    description: string,
    users: ProcessedUser[],
    getScopes: (user: ProcessedUser) => ResolvedUserScope[]
): PrincipalRecord {
    const scopeGroupsMap = new Map<string, {
        group: PrincipalScopeGroup;
        subgroupsMap: Map<string, PrincipalSubgroup>;
    }>();

    let accountCount = 0;

    for (const processedUser of users) {
        const scopes = getScopes(processedUser);
        if (!scopes.length)
            continue;

        accountCount++;

        for (const scope of scopes) {
            const groupKey =
                scope.type === 'global' ? 'global' : `event:${scope.eventSlug || scope.event}`;
            const groupTitle =
                scope.type === 'global' ? 'Global access' : (scope.event || 'Unknown event');

            let groupEntry = scopeGroupsMap.get(groupKey);
            if (!groupEntry) {
                groupEntry = {
                    group: {
                        key: groupKey,
                        title: groupTitle,
                        type: scope.type,
                        subgroups: [],
                    },
                    subgroupsMap: new Map(),
                };
                scopeGroupsMap.set(groupKey, groupEntry);
            }

            const subKey = `${scope.title || ''}|${scope.operations || ''}`;
            let subgroup = groupEntry.subgroupsMap.get(subKey);
            if (!subgroup) {
                subgroup = {
                    key: subKey,
                    title: scope.title,
                    operations: scope.operations,
                    users: [],
                };
                groupEntry.subgroupsMap.set(subKey, subgroup);
            }

            if (subgroup.users.at(-1)?.id !== processedUser.user.id)
                subgroup.users.push(processedUser.user);
        }
    }

    const groups: PrincipalScopeGroup[] = [];
    for (const { group, subgroupsMap } of scopeGroupsMap.values()) {
        group.subgroups = [ ...subgroupsMap.values() ].sort((lhs, rhs) => {
            const titleA = lhs.title || '';
            const titleB = rhs.title || '';

            if (titleA !== titleB)
                return titleA.localeCompare(titleB);

            return (lhs.operations || '').localeCompare(rhs.operations || '');
        });

        groups.push(group);
    }

    groups.sort((lhs, rhs) => {
        if (lhs.type === 'global') return -1;
        if (rhs.type === 'global') return 1;

        return lhs.title.localeCompare(rhs.title);
    });

    return {
        id,
        name,
        description,
        accountCount,
        groups,
    };
}

/**
 * The principals page displays an overview of all principals (users and service accounts) that have
 * been granted permissions or roles within the Volunteer Manager.
 */
export default async function PrincipalsPage() {
    await requireAuthentication('system.permissions');

    const dbInstance = db;

    // 1. Fetch permissions and roles configured in the database
    const permissions = await dbInstance.selectFrom(tPermissions)
        .select({
            id: tPermissions.permissionId,
            name: tPermissions.permissionName,
            description: tPermissions.permissionDescription,
            operations: tPermissions.permissionOperations,
        })
        .executeSelectMany();

    const permissionMap = new Map(permissions.map(p => [ p.id, p ]));

    const dbRoles = await dbInstance.selectFrom(tPermissionsRoles)
        .where(tPermissionsRoles.permissionRoleId.notEquals('root'))
        .select({
            id: tPermissionsRoles.permissionRoleId,
            name: tPermissionsRoles.permissionRoleName,
            description: tPermissionsRoles.permissionRoleDescription,
        })
        .orderBy(tPermissionsRoles.permissionRoleName, 'asc')
        .executeSelectMany();

    const roles = [ kRootRole, ...dbRoles ].sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
    const roleNameMap = new Map(roles.map(r => [ r.id, r.name ]));
    const roleAccessMap = new Map(roles.map(r => [
        r.id,
        new AccessControl({ grants: r.id, events: kAnyEvent, teams: kAnyTeam }),
    ]));

    // 2. Fetch users who have global grants or event-level role grants
    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const storageJoin = tStorage.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const users = await dbInstance.selectFrom(tUsers)
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(eventsJoin)
            .on(eventsJoin.eventId.equals(usersEventsJoin.eventId))
                .and(eventsJoin.eventHidden.equals(/* false= */ 0))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
                .and(rolesJoin.rolePermissionGrant.isNotNull())
                .and(eventsJoin.eventId.isNotNull())
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
                .and(rolesJoin.roleId.isNotNull())
        .where(tUsers.permissionsGrants.isNotNull()
            .or(rolesJoin.roleId.isNotNull()))
        .select({
            user: {
                id: tUsers.userId,
                name: tUsers.name,
                avatar: storageJoin.fileHash,
            },
            access: {
                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            },
            events: dbInstance.aggregateAsArray({
                eventSlug: eventsJoin.eventSlug,
                eventShortName: eventsJoin.eventShortName,
                roleGrant: rolesJoin.rolePermissionGrant,
                teamSlug: teamsJoin.teamSlug,
                teamName: teamsJoin.teamName,
            }),
        })
        .groupBy(tUsers.userId)
        .executeSelectMany();

    // 3. Process active users with their access models and event roles
    const processedUsers: ProcessedUser[] = users.flatMap(u => {
        const grants = u.access?.grants
            ? u.access.grants.split(',').map(g => g.trim()).filter(Boolean)
            : [];

        const eventRoles = (u.events || [])
            .filter(e => !!e.eventSlug && !!e.roleGrant)
            .map(e => ({
                roleGrant: e.roleGrant!,
                event: e.eventShortName || e.eventSlug!,
                eventSlug: e.eventSlug!,
                team: e.teamName || e.teamSlug || '',
            }));

        if (!grants.length && !eventRoles.length)
            return [];

        const globalAccess = new AccessControl({
            grants: u.access?.grants ? [ u.access.grants ] : [],
            revokes: u.access?.revokes,
            events: u.access?.events,
            teams: u.access?.teams,
        });

        const hasCustomScope = (!!u.access?.events || !!u.access?.teams) &&
            !(u.access?.events === kAnyEvent && u.access?.teams === kAnyTeam);
        const customScope = hasCustomScope
            ? [
                u.access?.events === kAnyEvent ? 'All events' : u.access?.events,
                u.access?.teams === kAnyTeam ? 'All teams' : u.access?.teams,
            ].filter(Boolean).join(' · ')
            : undefined;

        return [
            {
                user: {
                    id: u.user.id,
                    name: u.user.name,
                    avatar: getBlobUrl(u.user.avatar),
                },
                grants,
                globalAccess,
                hasCustomScope,
                customScope,
                eventRoles,
            },
        ];
    }).sort((lhs, rhs) => lhs.user.name.localeCompare(rhs.user.name));

    // 4. Build Roles Section
    const roleRecords: PrincipalRecord[] = roles.map(role =>
        buildPrincipalRecord(
            role.id, role.name, role.description || '', processedUsers,
            u => getRoleScopes(u, role.id)));

    // 5. Build Permissions Section
    const permissionDefinitions: PermissionDefinition[] = [];
    for (const [ key, descriptor ] of Object.entries(kPermissions)) {
        if (key === 'root' || key.startsWith('test.'))
            continue;

        const metadata = permissionMap.get(key);
        if (!metadata)
            continue;  // permissions must be defined first

        permissionDefinitions.push({
            id: key,
            name: metadata.name,
            description: metadata.description,
            operations: parseCrudOperations(metadata.operations),
            descriptor,
        });
    }

    permissionDefinitions.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    const permissionRecords: PrincipalRecord[] = permissionDefinitions.map(definition =>
        buildPrincipalRecord(
            definition.id, definition.name, definition.description, processedUsers,
            u => getPermissionScopes(u, definition, dbRoles, roleNameMap, roleAccessMap)));

    return (
        <>
            <Section icon={ <PersonOutlinedIcon color="primary" /> } title="Principals"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Principals' },
                     ]}>
                <SectionIntroduction>
                    Principals are users and service accounts that can be granted roles and
                    permissions throughout the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <PrincipalsAccordion items={roleRecords}
                                     emptyMessage="No roles have been configured in the system." />
            </Section>
            { kPermissionCategories.map(({ root, title }) => {
                const rootPermissions = permissionRecords.filter(p => p.id.startsWith(`${root}.`));
                if (!rootPermissions.length)
                    return null;

                return (
                    <Section key={root} icon={ <WorkspacesOutlinedIcon /> } title={title}>
                        <PrincipalsAccordion
                            items={rootPermissions}
                            emptyMessage="No accounts have been granted these permissions." />
                    </Section>
                );
            }) }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Principals', 'Permissions', 'System');
