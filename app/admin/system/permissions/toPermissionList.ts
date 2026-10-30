// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from '@lib/auth/AccessControl';
import type { AccessDescriptor, AccessOperation, AccessRestriction }
    from '@lib/auth/AccessDescriptor';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';

import { kPermissions } from '@lib/auth/Access';

/**
 * Supported operations for CRUD permissions, in canonical order.
 */
export const kCrudOperations: readonly AccessOperation[] = [
    'create',
    'read',
    'update',
    'delete',
];

/**
 * Suffix to distinguish the root of nested permissions from its children. Forms are submitted in
 * declaration order, which means that "foo: true" will be overridden by "foo: { bar }".
 */
export const kSelfSuffix = ':self';

/**
 * Parses a comma-separated list of CRUD operations into canonical order, falling back to all
 * supported CRUD operations when none are specified.
 */
export function parseCrudOperations(operations?: string | null): readonly AccessOperation[] {
    if (!operations)
        return kCrudOperations;

    const rawOperations = operations.split(',').map(op => op.trim());
    const filtered = kCrudOperations.filter(op => rawOperations.includes(op));

    return filtered.length > 0 ? filtered : kCrudOperations;
}

/**
 * Recursively collects the enabled permission identifiers from the nested `input` object.
 */
function collectPermissions(
    input: Record<string, unknown>, path: string, permissions: string[]): void
{
    for (const [ entry, value ] of Object.entries(input)) {
        const permissionName = entry.endsWith(kSelfSuffix)
            ? entry.slice(0, -kSelfSuffix.length)
            : entry;

        const permission = path ? `${path}.${permissionName}` : permissionName;
        if (typeof value === 'boolean') {
            if (value)
                permissions.push(permission);

        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            const record = value as Record<string, unknown>;
            if (Object.hasOwn(kPermissions, permission)) {
                const descriptor: AccessDescriptor =
                    kPermissions[permission as keyof typeof kPermissions];

                if (descriptor.type === 'crud') {
                    const operations = kCrudOperations.filter(operation => !!record[operation]);
                    if (operations.length === kCrudOperations.length) {
                        permissions.push(permission);
                    } else {
                        for (const operation of operations)
                            permissions.push(`${permission}:${operation}`);
                    }
                    continue;
                }
            }

            collectPermissions(record, permission, permissions);
        }
    }
}

/**
 * Converts the given `input` to a list of permissions as a string. The input is expected to be
 * formatted in line with `kAccountPermissionData.grants`, which means a nested object with keys
 * indicating the permission status.
 *
 * The given `userAccess` control object must represent access granted to the signed in user who is
 * making these changes. It's used to verify that permission restrictions are adhered to.
 *
 * @example input: { event: { applications: true, visible: false }, test: { boolean: true } }
 * @example output: event.applications,test.boolean
 */
export function toPermissionList(
    input: unknown, userAccess: AccessControl, existingAccess: AccessControl): string | null
{
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error(`Unexpected input type: "${typeof input}"`);

    const permissions: string[] = [];
    collectPermissions(input as Record<string, unknown>, /* path= */ '', permissions);

    if (!permissions.length)
        return null;

    // Verify that assignment restrictions are adhered to across all assigned permissions,
    // accounting for hierarchical inheritance.
    validatePermissionRestrictions(permissions, userAccess, existingAccess);

    return permissions.join(',');
}

/**
 * Verifies that assignment restrictions are adhered to across all `permissions`, accounting for
 * hierarchical inheritance. Throws an Error when a restricted permission cannot be assigned.
 */
export function validatePermissionRestrictions(
    permissions: Iterable<string>, userAccess: AccessControl, existingAccess: AccessControl)
    : void | never
{
    for (const fullPermission of permissions) {
        const [ permission, operation ] = fullPermission.split(':', 2);

        for (const [ verificationPermission, rawDescriptor ] of Object.entries(kPermissions)) {
            const descriptor: AccessDescriptor = rawDescriptor;
            if (!descriptor.restrict)
                continue;  // the |verificationPermission| has no restrictions

            if (verificationPermission !== permission &&
                    !verificationPermission.startsWith(`${permission}.`)) {
                continue;  // not relevant for the current |permission|
            }

            if (typeof descriptor.restrict === 'string') {
                validateRestriction(
                    verificationPermission, descriptor.restrict, userAccess, existingAccess);
            } else {
                for (const verificationOperation of kCrudOperations) {
                    const restriction = descriptor.restrict[verificationOperation];
                    if (!restriction)
                        continue;  // the |verificationOperation| has no restrictions

                    if (!!operation && operation !== verificationOperation)
                        continue;  // the |verificationOperation| is not relevant

                    validateRestriction(
                        `${verificationPermission}:${verificationOperation}`,
                        restriction, userAccess, existingAccess);
                }
            }
        }
    }
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
        if (existingAccess.can(permission as BooleanPermission))
            return;  // this permission has already been granted
    } else {
        if (existingAccess.can(permission as CRUDPermission, operation as AccessOperation))
            return;  // this permission has already been granted
    }

    throw new Error(`You are not able to assign the "${fullPermission}" permission`);
}
