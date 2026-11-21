// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, unauthorized } from 'next/navigation';

import type { AccessControl } from './AccessControl';
import type { AccessOperation } from './AccessDescriptor';
import type { AccessScope } from './AccessList';
import type { AuthenticationContext } from '../AuthenticationContextTypes';
import type { BooleanPermission, CRUDPermission } from './Access';

/**
 * Access check for a specific permission. May be a simple boolean permission, or a CRUD permission
 * which requires a specific operation to be allowed.
 */
export type PermissionAccessCheck =
    BooleanPermission |
    {
        permission: BooleanPermission;
        scope?: AccessScope;
    } |
    {
        permission: CRUDPermission;
        operation: AccessOperation;
        scope?: AccessScope;
    };

/**
 * A set of permission checks, either where all ("and") or any ("or") of the checks must pass.
 */
export type PermissionSet = {
    type: 'and' | 'or';
    checks: PermissionAccessCheck[];
};

export function and(...permissions: PermissionAccessCheck[]): PermissionSet {
    return { type: 'and', checks: permissions };
}

export function or(...permissions: PermissionAccessCheck[]): PermissionSet {
    return { type: 'or', checks: permissions };
}

/**
 * Executes a permission `check` on the given `access` object.
 */
function checkIndividualPermission(
    access: AccessControl, check: PermissionAccessCheck, scope?: AccessScope): boolean
{
    if (typeof check === 'string')
        return access.can(check as BooleanPermission, scope);

    if ('operation' in check) {
        const permission = check.permission as CRUDPermission;
        if (access.can(permission, check.operation, check.scope ?? scope))
            return true;  // permission has been granted

    } else {
        const permission = check.permission as BooleanPermission;
        if (access.can(permission, check.scope ?? scope))
            return true;  // permission has been granted
    }

    return false;
}

/**
 * Executes a permission `check` on the given `access` object, which may also be a set of checks
 * that should be executed with a particular result in mind.
 */
export function checkPermission(
    access: AccessControl, permission: PermissionAccessCheck | PermissionSet, scope?: AccessScope)
        : boolean
{
    if (typeof permission !== 'string' && 'type' in permission) {
        if (!permission.checks.length)
            return false;

        let count = 0;
        for (const individualPermission of permission.checks)
            count += checkIndividualPermission(access, individualPermission, scope) ? 1 : 0;

        return permission.type === 'and' ? /* && */ count === permission.checks.length
                                         : /* || */ count > 0;
    }

    return checkIndividualPermission(access, permission, scope);
}

/**
 * Executes the given `permission` check. An HTTP 401 Unauthorized or HTTP 403 Forbidden error will
 * be thrown when the access check fails.
 */
export function executeAccessCheck(
    context: AuthenticationContext,
    permission: PermissionAccessCheck | PermissionSet,
    scope?: AccessScope): void | never
{
    if (!checkPermission(context.access, permission, scope)) {
        !!context.user ? forbidden()
                       : unauthorized();
    }
}
