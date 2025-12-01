// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from '@lib/auth/AccessControl';
import type { AccessDescriptor, AccessOperation, AccessRestriction } from '@lib/auth/AccessDescriptor';

import { kPermissions, type BooleanPermission, type CRUDPermission } from '@lib/auth/Access';

/**
 * Suffix to distinguish the root of nested permissions from its children. Forms are submitted in
 * declaration order, which means that "foo: true" will be overridden by "foo: { bar }".
 */
export const kSelfSuffix = ':self';

/**
 * Converts the given `input` to a list of permissions as a string. The input is expected to be
 * formatted in line with `kAccountPermissionData.grants`, which means a nested object with keys
 * indicating the permission status.
 *
 * The given `access` control object must represent access granted to the signed in user who is
 * making these changes. It's used to verify that permission restrictions are adhered to.
 *
 * @example input: { event: { applications: true, visible: false }, test: { boolean: true } }
 * @example output: event.applications,test.boolean
 */
export function toPermissionList(
    input: any, userAccess: AccessControl, existingAccess: AccessControl, path?: string,
    permissions?: string[]): string | null
{
    permissions ??= [ /* empty array */ ];

    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error(`Unexpected input type: "${typeof input}"`);

    const isRoot = !path;

    for (const entry of Object.keys(input)) {
        let permissionName = entry;
        if (permissionName.endsWith(kSelfSuffix))
            permissionName = entry.substring(0, entry.length - kSelfSuffix.length);

        const permission = isRoot ? permissionName : `${path}${permissionName}`;
        if (typeof input[entry] === 'boolean') {
            if (!!input[entry])
                permissions.push(permission);

        } else if (typeof input[entry] === 'object') {
            const typedPermission: BooleanPermission | CRUDPermission = permission as any;
            if (Object.hasOwn(kPermissions, typedPermission)) {
                const descriptor: AccessDescriptor = kPermissions[typedPermission];
                if (descriptor.type === 'crud') {
                    const operations: string[] = [ /* none */ ];
                    for (const operation of [ 'create', 'read', 'update', 'delete' ]) {
                        if (!!input[entry][operation])
                            operations.push(operation);
                    }

                    if (operations.length === /* all= */ 4) {
                        permissions.push(permission);
                    } else {
                        for (const includedOperation of operations)
                            permissions.push(`${permission}:${includedOperation}`);
                    }

                    continue;
                }
            }

            toPermissionList(
                input[entry], userAccess, existingAccess, `${permission}.`, permissions);
        }
    }

    if (isRoot && permissions.length > 0) {
        // Do an O(kn) sweep op all assigned permissions to verify that assignment restrictions are
        // adhered to. This is an expensive operation, but is most rigorous in light of inheritance.
        for (const fullPermission of permissions) {
            const [ permission, operation ] = fullPermission.split(':', 2);

            for (const [ verificationPermission, descriptor ] of Object.entries(kPermissions)) {
                if (!verificationPermission.startsWith(permission))
                    continue;  // not relevant for the current |permission|

                if (!('restrict' in descriptor))
                    continue;  // the |verificationPermission| has no restrictions

                if (typeof descriptor.restrict === 'string') {
                    validateRestriction(
                        fullPermission, descriptor.restrict, userAccess, existingAccess);
                } else {
                    for (const verificationOperation of [ 'create', 'read', 'update', 'delete' ]) {
                        if (!(verificationOperation in descriptor.restrict))
                            continue;  // the |verificationOperation| has no restrictions

                        if (!!operation && operation !== verificationOperation)
                            continue;  // the |verificationOperation| is not relevant

                        const typedVerificationOperation =
                            verificationOperation as keyof typeof descriptor.restrict;

                        validateRestriction(
                            `${verificationPermission}:${verificationOperation}`,
                            descriptor.restrict[typedVerificationOperation],
                            userAccess, existingAccess);
                    }
                }
            }
        }

        return permissions.join(',');
    }

    return null;
}

/**
 * Returns whether the |restriction| is in effect based on the given |access| object.
 */
export function isRestricted(restriction: AccessRestriction, access: AccessControl): boolean {
    switch (restriction) {
        case 'root':
            return !access.can('root');
    }

    throw new Error(`Unhandled permission restriction: ${restriction}`);
}

/**
 * Validates that the given |restriction| is allowed to be overridden by the given |access| object.
 * Doesn't return anything when passed, will throw an exception when failed.
 */
function validateRestriction(
    fullPermission: string, restriction: AccessRestriction, userAccess: AccessControl,
    existingAccess: AccessControl): void | never
{
    if (!isRestricted(restriction, userAccess))
        return;  // there are no applied restrictions

    const [ permission, operation ] = fullPermission.split(':');
    if (!operation) {
        const booleanPermission = permission as BooleanPermission;

        if (existingAccess.can(booleanPermission))
            return;  // this permission has already been granted

    } else {
        const crudPermission = permission as CRUDPermission;
        const crudOperation = operation as AccessOperation;

        if (existingAccess.can(crudPermission, crudOperation))
            return;  // this permission has already been granted
    }

    throw new Error(`You are not able to assign the "${fullPermission}" permission`);
}
