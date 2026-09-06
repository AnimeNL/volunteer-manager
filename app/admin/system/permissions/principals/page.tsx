// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';

import type { AccessDescriptor } from '@lib/auth/AccessDescriptor';
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

import { kPermissions, type BooleanPermission, type CRUDPermission } from '@lib/auth/Access';
import { kRegistrationStatus } from '@lib/database/Types';
import { kRootRole } from '../Root';

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
    const processedUsers = users.flatMap(u => {
        const grants = u.access?.grants
            ? u.access.grants.split(',').map(g => g.trim()).filter(Boolean)
            : [];

        const eventRoles = (u.events || [])
            .filter(e => !!e.eventSlug && !!e.roleGrant)
            .map(e => ({
                roleGrant: e.roleGrant!,
                scope: `${e.eventShortName || e.eventSlug} · ${e.teamName || e.teamSlug}`,
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
        const scope = hasCustomScope
            ? [ u.access?.events === '*' ? 'All events' : u.access?.events,
                u.access?.teams === '*' ? 'All teams' : u.access?.teams ].filter(Boolean).join(' · ')
            : 'Global';

        return [{
            id: u.user.id,
            name: u.user.name,
            avatar: getBlobUrl(u.user.avatar),
            grants,
            globalAccess,
            hasCustomScope,
            scope,
            eventRoles,
        }];
    });

    // 4. Build Roles Section
    const roleRecords: PrincipalRecord[] = roles.map(role => {
        const roleUsers: PrincipalUser[] = [];

        for (const u of processedUsers) {
            const scopes: PrincipalUserScope[] = [];

            if (u.grants.includes(role.id))
                scopes.push({ scope: u.scope });

            const hasGlobalSuperRole =
                (u.grants.includes('root') || u.grants.includes('admin')) && !u.hasCustomScope;

            if (!u.grants.includes(role.id) && !hasGlobalSuperRole) {
                for (const e of u.eventRoles) {
                    if (e.roleGrant === role.id)
                        scopes.push({ scope: e.scope });
                }
            }

            if (scopes.length)
                roleUsers.push({ id: u.id, name: u.name, avatar: u.avatar, scopes });
        }

        roleUsers.sort((a, b) => a.name.localeCompare(b.name));

        return {
            id: role.id,
            name: role.name,
            description: role.description || '',
            users: roleUsers,
        };
    });

    // 5. Build Permissions Section
    type PermissionMetadata = {
        id: string;
        name: string;
        description: string;
        descriptor: AccessDescriptor;
    };

    const permissionDefinitions: PermissionMetadata[] = [];
    for (const [ key, rawDescriptor ] of Object.entries(kPermissions)) {
        if (key === 'root' || key === 'admin' || key.startsWith('test.'))
            continue;

        const metadata = permissionMap.get(key);
        if (!metadata)
            continue;  // permissions must be defined first

        permissionDefinitions.push({
            id: key,
            name: metadata.name,
            description: metadata.description,
            descriptor: rawDescriptor as AccessDescriptor
        });
    }

    permissionDefinitions.sort((a, b) => a.name.localeCompare(b.name));

    const permissionRecords: PrincipalRecord[] = permissionDefinitions.map(definition => {
        const permUsers: PrincipalUser[] = [];

        for (const u of processedUsers) {
            const scopes: PrincipalUserScope[] = [];

            if (checkPermissionGranted(u.globalAccess, definition.descriptor, definition.id)) {
                let source = 'Global grant';
                if (u.grants.includes(definition.id)) {
                    source = 'Direct grant';
                } else if (u.grants.includes('root')) {
                    source = 'Root administrator';
                } else {
                    const matchingRole = dbRoles.find(r => u.grants.includes(r.id));
                    if (matchingRole)
                        source = matchingRole.name;
                }
                scopes.push({ scope: u.scope, source });
            } else {
                for (const e of u.eventRoles) {
                    if (checkPermissionGranted(e.access, definition.descriptor, definition.id)) {
                        const matchingRole = dbRoles.find(r => r.id === e.roleGrant);
                        scopes.push({ scope: e.scope, source: matchingRole?.name ?? e.roleGrant });
                    }
                }
            }

            if (scopes.length)
                permUsers.push({ id: u.id, name: u.name, avatar: u.avatar, scopes });
        }

        permUsers.sort((a, b) => a.name.localeCompare(b.name));

        return {
            id: definition.id,
            name: definition.name,
            description: definition.description,
            users: permUsers,
        };
    });

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
            { [
                { root: 'event', title: 'Events' },
                { root: 'organisation', title: 'Organisation' },
                { root: 'statistics', title: 'Statistics' },
                { root: 'system', title: 'System' },
                { root: 'volunteers', title: 'Volunteers' },
            ].map(({ root, title }) => {
                const rootPermissions = permissionRecords.filter(p => p.id.startsWith(`${root}.`));
                if (!rootPermissions.length)
                    return null;

                return (
                    <Section key={root} icon={ <WorkspacesOutlinedIcon /> } title={title}>
                        <PrincipalsAccordion items={rootPermissions}
                                             emptyMessage="No accounts have been granted these permissions." />
                    </Section>
                );
            }) }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Principals', 'Permissions', 'System');
