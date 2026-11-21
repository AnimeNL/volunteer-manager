// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import { Cache } from '@lib/cache';
import db, { tPermissionsRoles } from '@lib/database';

import { kPermissionGroups } from './Access';

/**
 * Ability to explicitly set the roles that the system should be initialised with for tests.
 */
type RolesForTesting = { role: string; grants?: string; revokes?: string; }[];

/**
 * Provides one-off initialisation of permission roles by fetching them from the database and
 * storing them in the Cache. Any further modifications will be synchronised in the Cache directly.
 */
export async function initialisePermissionRoles(rolesForTesting?: RolesForTesting): Promise<void> {
    const cache = Cache.getInstance('PermissionRoles');
    const roles = rolesForTesting || await db.selectFrom(tPermissionsRoles)
        .select({
            role: tPermissionsRoles.permissionRoleId,
            grants: tPermissionsRoles.permissionRoleGrants,
            revokes: tPermissionsRoles.permissionRoleRevokes,
        })
        .executeSelectMany();

    for (const { role, grants, revokes } of roles) {
        cache.set(role, {
            grants: grants?.split(',') || [ /* no grants */ ],
            revokes: revokes?.split(',') || [ /* no revokes */ ],
        });
    }

    cache.set('root', {
        grants: kPermissionGroups,
        revokes: [ /* no revokes */ ],
    });
}
