// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';

import type { AccessDescriptor } from '@lib/auth/AccessDescriptor';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import type { PrincipalRecord, PrincipalUser, PrincipalUserScope } from './PrincipalsAccordions';
import { AccessControl, kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { PrincipalsAccordion } from './PrincipalsAccordions';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getBlobUrl } from '@lib/database/BlobStore';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents, tPermissions, tPermissionsRoles, tRoles, tStorage, tTeams, tUsers,
    tUsersEvents } from '@lib/database';

import { kPermissions } from '@lib/auth/Access';
import { kRegistrationStatus } from '@lib/database/Types';
import { kRootRole } from '../Root';

/**
 * Represents a user who has active access grants or event roles, ready for inspection.
 */
interface ProcessedUser {
    id: number;
    name: string;
    avatar?: string;
    grants: string[];
    globalAccess: AccessControl;
    hasCustomScope: boolean;
    customScope?: string;
    eventRoles: {
        roleGrant: string;
        event: string;
        eventSlug: string;
        team: string;
        access: AccessControl;
    }[];
}

/**
 * Metadata for a permission defined in the system.
 */
interface PermissionDefinition {
    id: string;
    name: string;
    description: string;
    operations: string[];
    descriptor: AccessDescriptor;
}

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
 * Checks whether the given permission is granted under the given `access` control instance.
 */
function checkPermissionGranted(
    access: AccessControl, descriptor: AccessDescriptor, permissionName: string): boolean
{
    const scope = { event: kAnyEvent, team: kAnyTeam };
    if (descriptor.type === 'boolean')
        return access.can(permissionName as BooleanPermission, scope);

    return ([ 'read', 'create', 'update', 'delete' ] as const).some(op =>
        access.can(permissionName as CRUDPermission, op, scope));
}

/**
 * Returns the granted operations for a CRUD permission, or undefined if all (or not CRUD).
 */
function getGrantedOperations(
    access: AccessControl,
    permissionId: string,
    supportedOperations: string[],
    isCrud: boolean
): string[] | undefined {
    if (!isCrud)
        return undefined;

    const ops = supportedOperations.filter(op =>
        access.can(permissionId as CRUDPermission, op as any, {
            event: kAnyEvent,
            team: kAnyTeam,
        }));

    return ops.length < supportedOperations.length ? ops : undefined;
}

/**
 * Resolves the source description for a globally granted permission.
 */
function resolveGlobalGrantSource(
    grants: string[], permissionId: string, dbRoles: { id: string; name: string }[]): string
{
    if (grants.includes(permissionId))
        return 'Direct grant';
    if (grants.includes('root'))
        return 'Root administrator';

    const matchingRole = dbRoles.find(r => grants.includes(r.id));
    if (matchingRole)
        return matchingRole.name;

    return 'Global grant';
}

/**
 * Computes scopes for a specific role and user.
 */
function getRoleScopes(user: ProcessedUser, roleId: string): PrincipalUserScope[] {
    if (user.grants.includes(roleId))
        return [{ type: 'global', customScope: user.customScope }];

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
            team: e.team,
        }));
}

/**
 * Computes scopes for a specific permission and user.
 */
function getPermissionScopes(
    user: ProcessedUser,
    definition: PermissionDefinition,
    dbRoles: { id: string; name: string }[],
    roleNameMap: Map<string, string>
): PrincipalUserScope[] {
    const isCrud = definition.descriptor.type === 'crud';

    if (checkPermissionGranted(user.globalAccess, definition.descriptor, definition.id)) {
        return [{
            type: 'global',
            customScope: user.customScope,
            operations: getGrantedOperations(
                user.globalAccess, definition.id, definition.operations, isCrud),
            source: resolveGlobalGrantSource(user.grants, definition.id, dbRoles),
        }];
    }

    const scopes: PrincipalUserScope[] = [];
    for (const e of user.eventRoles) {
        if (checkPermissionGranted(e.access, definition.descriptor, definition.id)) {
            scopes.push({
                type: 'event',
                event: e.event,
                eventSlug: e.eventSlug,
                team: e.team,
                operations: getGrantedOperations(
                    e.access, definition.id, definition.operations, isCrud),
                source: roleNameMap.get(e.roleGrant) ?? e.roleGrant,
            });
        }
    }

    return scopes;
}

/**
 * Collects and sorts users that have matching scopes for a principal record.
 */
function collectPrincipalUsers(
    users: ProcessedUser[],
    getScopes: (user: ProcessedUser) => PrincipalUserScope[]
): PrincipalUser[] {
    const principalUsers: PrincipalUser[] = [];

    for (const user of users) {
        const scopes = getScopes(user);
        if (scopes.length > 0)
            principalUsers.push({ id: user.id, name: user.name, avatar: user.avatar, scopes });
    }

    return principalUsers.sort((a, b) => a.name.localeCompare(b.name));
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

    // 2. Fetch users and their permissions and event-level roles
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
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
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
                access: new AccessControl({
                    grants: {
                        permission: e.roleGrant!,
                        event: e.eventSlug!,
                        team: e.teamSlug || '',
                    },
                }),
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
            !(u.access?.events === '*' && u.access?.teams === '*');
        const customScope = hasCustomScope
            ? [
                u.access?.events === '*' ? 'All events' : u.access?.events,
                u.access?.teams === '*' ? 'All teams' : u.access?.teams,
            ].filter(Boolean).join(' · ')
            : undefined;

        return [{
            id: u.user.id,
            name: u.user.name,
            avatar: getBlobUrl(u.user.avatar),
            grants,
            globalAccess,
            hasCustomScope,
            customScope,
            eventRoles,
        }];
    });

    // 4. Build Roles Section
    const roleRecords: PrincipalRecord[] = roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description || '',
        users: collectPrincipalUsers(processedUsers, u => getRoleScopes(u, role.id)),
    }));

    // 5. Build Permissions Section
    const permissionDefinitions: PermissionDefinition[] = [];
    for (const [ key, rawDescriptor ] of Object.entries(kPermissions)) {
        if (key === 'root' || key === 'admin' || key.startsWith('test.'))
            continue;

        const metadata = permissionMap.get(key);
        if (!metadata)
            continue;  // permissions must be defined first

        const rawOperations = metadata.operations
            ? metadata.operations.split(',').map(op => op.trim()).filter(Boolean)
            : [];
        const supportedOperations = rawOperations.length > 0
            ? rawOperations
            : [ 'create', 'read', 'update', 'delete' ];

        permissionDefinitions.push({
            id: key,
            name: metadata.name,
            description: metadata.description,
            operations: supportedOperations,
            descriptor: rawDescriptor as AccessDescriptor,
        });
    }

    permissionDefinitions.sort((a, b) => a.name.localeCompare(b.name));

    const permissionRecords: PrincipalRecord[] = permissionDefinitions.map(definition => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        users: collectPrincipalUsers(
            processedUsers, u => getPermissionScopes(u, definition, dbRoles, roleNameMap)),
    }));

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
