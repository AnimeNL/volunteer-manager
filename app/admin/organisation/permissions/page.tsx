// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import CategoryIcon from '@mui/icons-material/Category';

import type { AccessDescriptor } from '@lib/auth/AccessDescriptor';
import { AccessControl, kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { PermissionsTable, type PermissionRecord, type PermissionUserRecord } from './PermissionsTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '../../lib/generatePageMetadata';
import { getBlobUrl } from '@lib/database/BlobStore';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tRoles, tStorage, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kPermissions, type BooleanPermission, type CRUDPermission } from '@lib/auth/Access';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Helper function that lowercases the first letter of the given `text`.
 */
function lowercaseFirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Helper function that capitalises the first letter of the given `text`.
 */
function uppercaseFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Information required for a "limited access" permission grant.
 */
type LimitedAccess = {
    access: AccessControl;
    event: string;
    team: string;
};

/**
 * Information required for each user who has been granted at least a single permission.
 */
type UserAccessInfo = {
    access?: AccessControl;
    limitedAccess: LimitedAccess[];
    user: PermissionUserRecord;
};

/**
 * Information necessary to run a permission check.
 */
interface CheckInfo {
    access?: AccessControl;
    descriptor: AccessDescriptor;
    name: string;
    operation?: 'create' | 'read' | 'update' | 'delete';
}

/**
 * Checks whether the detailed permission has been granted, all based on `info`.
 */
function check(info: CheckInfo): boolean {
    if (!info.access)
        return false;  // no access at all

    const { access, descriptor, name, operation } = info;
    if (descriptor.type === 'boolean') {
        return access.can(name as BooleanPermission, {
            event: kAnyEvent,
            team: kAnyTeam,
        });
    }

    const queryResult = access.query(name as CRUDPermission, operation ?? 'read', {
        event: kAnyEvent,
        team: kAnyTeam,
    });

    if (queryResult && queryResult.result === 'granted') {
        if (!operation)
            return !queryResult.crud;

        return true;
    }

    return false;
}

/**
 * Information necessary to populate permission information.
 */
interface PermissionInfo {
    descriptor: AccessDescriptor;
    name: string;
    operation?: 'create' | 'read' | 'update' | 'delete';
    userRecords: UserAccessInfo[];
}

/**
 * Populates a row in the `target`, populated with information on the number of users who have been
 * granted the applicable permission, if any.
 */
function populatePermission(target: PermissionRecord[], info: PermissionInfo): void {
    const { descriptor, name, operation, userRecords } = info;

    const permission: PermissionRecord = !!operation ?
        {
            id: `${name}:${operation}`,
            permission: name,
            name: `${uppercaseFirst(operation)} ${lowercaseFirst(descriptor.name)}`,
            operation,
            users: [ /* empty */ ],
        } : {
            id: name,
            permission: name,
            name: descriptor.name,
            description: descriptor.description,
            users: [ /* empty */ ],
        };

    for (const userRecord of userRecords) {
        const permissionGranted = check({ access: userRecord.access, descriptor, name, operation });
        if (permissionGranted) {
            permission.users.push(userRecord.user);
        } else {
            for (const { access, event, team } of userRecord.limitedAccess) {
                if (!check({ access, descriptor, name, operation }))
                    continue;

                permission.users.push({ ...userRecord.user, event, team });
            }
        }
    }

    target.push(permission);
}

/**
 * The <PermissionsPage> displays an overview of the permissions that exist within the Volunteer
 * Manager, with the ability to immediately see to whom they are available, and why.
 */
export default async function PermissionsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.permissions',
            operation: 'read',
        },
    });

    // ---------------------------------------------------------------------------------------------

    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const storageJoin = tStorage.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const dbInstance = db;
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
                permission: rolesJoin.rolePermissionGrant,
                event: eventsJoin.eventSlug,
                team: teamsJoin.teamSlug,
            }),
        })
        .groupBy(tUsers.userId)
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    const userRecords: UserAccessInfo[] = [ /* empty */ ];

    for (const user of users) {
        let access: AccessControl | undefined = undefined;
        const limitedAccess: LimitedAccess[] = [ /* none */ ];

        if (!!user.access)
            access = new AccessControl(user.access);

        for (const event of user.events) {
            if (!event.event || !event.team || !event.permission)
                continue;  // no permissions were granted for this event

            const grant = {
                permission: event.permission!,
                event: event.event!,
                team: event.team!,
            };

            limitedAccess.push({
                access: new AccessControl({ grants: grant }),
                event: event.event!,
                team: event.team!,
            });
        }

        if (!access && !limitedAccess.length)
            continue;  // this user has not been granted any special permissions

        userRecords.push({
            access,
            limitedAccess,
            user: {
                ...user.user,
                avatar: getBlobUrl(user.user.avatar),
            },
        });
    }

    // ---------------------------------------------------------------------------------------------

    const permissions: PermissionRecord[] = [ /* empty */ ];

    // Note that the performance of this iteration is O(k*3n), where 'k' is the number of
    // permissions and 'n' is the number of users who have been granted permissions. In practice
    // these numbers will both be below ~50, and this is an internal diagnostics page.
    for (const [ name, rawDescriptor ] of Object.entries(kPermissions)) {
        const descriptor: AccessDescriptor = rawDescriptor;

        if (typeof descriptor.hide === 'boolean' && !!descriptor.hide)
            continue;  // this permission has been explicitly hidden

        if (descriptor.type === 'boolean') {
            populatePermission(permissions, { descriptor, name, userRecords });
        } else {
            populatePermission(permissions, { descriptor, name, userRecords });

            for (const operation of [ 'create', 'read', 'update', 'delete' ] as const) {
                if (Array.isArray(descriptor.hide) && descriptor.hide.includes(operation))
                    continue;

                populatePermission(permissions, { descriptor, name, operation, userRecords });
            }
        }
    }

    return (
        <Section title="Permissions" icon={ <CategoryIcon color="primary" /> } breadcrumbs={[
            { label: 'Organisation', href: '/admin/organisation' },
            { label: 'Permissions' },
        ]}>
            <SectionIntroduction>
                This page shows all the available permissions and who has them. It's your go-to spot
                for tracking who is allowed to do what.
            </SectionIntroduction>
            <PermissionsTable permissions={permissions} />
        </Section>
    );
}

export const generateMetadata = createGenerateMetadataFn('Permissions', 'Organisation');
