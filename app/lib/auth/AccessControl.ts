// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';

import type { AccessDescriptor, AccessOperation } from './AccessDescriptor';
import type { AccessScope, Grant, Result } from './AccessList';
import type { BooleanPermission, CRUDPermission } from './Access';
import { AccessList, kAnyEvent, kAnyTeam } from './AccessList';

import { kPermissionGroups, kPermissions } from './Access';

/**
 * Re-export types from the underlying `AccessList` mechanism that are useful elsewhere.
 */
export type { AccessScope, Grant };
export { kAnyEvent, kAnyTeam };

/**
 * Pattern that defines the valid syntax for an individual permission, which are single-word alpha-
 * numeric sequences separated by a period. (E.g. "foo.bar.baz".)
 *
 * @visible Exclusively for testing purposes.
 */
export const kPermissionPattern = /^[a-z][\w-]*(?:\.[\w-]+)*(?:\:(create|read|update|delete))*$/;

// -------------------------------------------------------------------------------------------------

/**
 * Parameters that can be passed to the `AccessControl` constructor, defining the input information
 * necessary to fully define the scope of access for a particular user.
 */
export type AccessControlParams = {
    /**
     * Permissions that have been granted to the user, if any. These are in addition to implicit
     * grants based on event-level allocations, i.e. by being assigned to a Senior-level position.
     */
    grants?: Grant | Grant[];

    /**
     * Permissions that have been revoked for the user, if any. These take precedent over both
     * explicit grants, and implicit grants based on event-level allocations.
     */
    revokes?: Grant | Grant[];

    /**
     * Events that access should be granted to. By default no events are accessible, although some
     * permissions may not be associated with a particular event. Certain permissions may be granted
     * specific to a given event based on Senior-level access.
     */
    events?: string;

    /**
     * Teams that access should be granted to. By default no teams are accessible, although certain
     * permissions may be granted specific to a given team based on Senior-level access.
     */
    teams?: string;
};

/**
 * Result that will be issued from an `AccessControl` query when the requested permission was found
 * to exist on either the grant or revocation access lists.
 */
export type AccessResult = Result & {
    /**
     * Whether the access query resulted in the permission being granted or revoked.
     */
    result: 'granted' | 'revoked';

    /**
     * Whether the access query result was on the specific CRUD operation.
     */
    crud: boolean;
};

// -------------------------------------------------------------------------------------------------

/**
 * The `AccessControl` object enables consistent access checks throughout the Volunteer Manager
 * system. Our permissions are hierarchical, resource-based and follow CRUD patterns. Furthermore,
 * the permissions themselves are predefined in the `Access.ts` file.
 *
 * There are two axes specific to the Volunteer Manager: grants that are scoped to a particular
 * event, and grants that are scoped to a particular team. Possibly both. This enables implicitly
 * granted permissions based on a volunteer's role in a particular event.
 *
 * Individual permissions have hierarchical names, each scope separated by a dot, with the most
 * significant scope being the left-most entry. CRUD permissions can further have modifiers on the
 * permission that indicate the scope, e.g. "foo.bar:update".
 */
export class AccessControl {
    #grants: AccessList;
    #revokes: AccessList;

    constructor(grants: AccessControlParams) {
        this.#revokes = new AccessList({
            grants: grants.revokes,
            requireSpecificScope: true,
        });

        this.#grants = new AccessList({
            expansions: kPermissionGroups,
            grants: grants.grants,
            events: grants.events,
            teams: grants.teams,
        });
    }

    /**
     * Gets the events that access should be granted to.
     */
    get events(): string[] { return this.#grants.events; }

    /**
     * Gets the teams that access should be granted to.
     */
    get teams(): string[] { return this.#grants.teams; }

    /**
     * Checks whether the given `permission` has been granted. Optionally, a `scope` may be given
     * which adds additional granularity to the check, as permissions don't have to be granted for
     * every event and team. CRUD-based permissions require an `operation` to be specified.
     *
     * Permission checks are hierarchical, which means that someone granted the "event" permission
     * also has access to the "event.visible" permission. These checks are done in order of highest
     * specificity, to make sure that the most specific grant (and/or revoke) will be considered.
     */
    can(permission: BooleanPermission, scope?: AccessScope): boolean;
    can(permission: CRUDPermission, operation: AccessOperation, scope?: AccessScope): boolean;
    can(permission: BooleanPermission | CRUDPermission, second?: any, third?: any): boolean {
        return this.query(permission as any, second, third)?.result === 'granted';
    }

    /**
     * Queries the status of the given `permission`, which contains full information on why the
     * permission was either granted or revoked, if set at all. Optionally, a `scope` may be given
     * which adds additional granularity to the query, as permissions don't have to be granted for
     * every event and team. CRUD-based permissions require an `operation` to be specified.
     *
     * Permission queries are hierarchical, which means that someone granted the "event" permission
     * also has access to the "event.visible" permission. These queries are done in order of highest
     * specificity, to make sure that the most specific grant (and/or revoke) will be considered.
     */
    query(permission: BooleanPermission, scope?: AccessScope): AccessResult | undefined;
    query(permission: CRUDPermission, operation: AccessOperation, scope?: AccessScope)
        : AccessResult | undefined;
    query(permission: BooleanPermission | CRUDPermission, second?: any, third?: any)
        : AccessResult | undefined
    {
        if (!kPermissionPattern.test(permission))
            throw new Error(`Invalid syntax for the given permission: "${permission}"`);

        if (!Object.hasOwn(kPermissions, permission))
            throw new Error(`Unrecognised permission: "${permission}"`);

        const descriptor: AccessDescriptor = kPermissions[permission];
        const accessScope: AccessScope | undefined = descriptor.type === 'crud' ? third : second;

        if (descriptor.requireEvent && !accessScope?.event)
            throw new Error(`The "event" scope is required when checking "${permission}" access`);

        if (descriptor.requireTeam && !accessScope?.team)
            throw new Error(`The "team" scope is required when checking "${permission}" access`);

        // The qualified permission is either the full permission path for boolean permissions, or
        // the full path with an annotation for the requested operation for CRUD-based permissions.
        const qualifiedPermission =
            descriptor.type === 'crud' ? `${permission}:${second}`
                                       : permission;

        let length = qualifiedPermission.length;
        while (length > /* at least a partial permission - */ 0) {
            const qualifiedPermissionScope = qualifiedPermission.substring(0, length);

            const expanded = qualifiedPermission.length !== length;
            const crud = descriptor.type === 'crud' && !expanded;

            const revocation = this.#revokes.query(qualifiedPermissionScope, accessScope);
            if (revocation) {
                return {
                    ...revocation,
                    result: 'revoked',
                    expanded: expanded || revocation.expanded,
                    crud,
                };
            }

            const grant = this.#grants.query(qualifiedPermissionScope, accessScope);
            if (grant) {
                return {
                    ...grant,
                    result: 'granted',
                    expanded: expanded || grant.expanded,
                    crud,
                };
            }

            length = Math.max(
                qualifiedPermission.lastIndexOf(':', length - 1),
                qualifiedPermission.lastIndexOf('.', length - 1));
        }

        return undefined;
    }

    /**
     * Requires that the given `permission` has been granted, or throw a Next.js exception that will
     * yield an HTTP 403 Forbidden error to be shown instead of the requested content. Optionally, a
     * `scope` may be given which adds additional granularity to the query, as permissions don't
     * have to be granted for every event and team. CRUD-based permissions require an `operation` to
     * be specified.
     *
     * Permission queries are hierarchical, which means that someone granted the "event" permission
     * also has access to the "event.visible" permission. These queries are done in order of highest
     * specificity, to make sure that the most specific grant (and/or revoke) will be considered.
     */
    require(permission: BooleanPermission, scope?: AccessScope): void;
    require(permission: CRUDPermission, operation: AccessOperation, scope?: AccessScope): void;
    require(permission: BooleanPermission | CRUDPermission, second?: any, third?: any): void {
        if (!this.can(permission as any, second, third))
            forbidden();
    }
}
