// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Type definition for a grant, which can either be an individual grant without scope, or one that
 * is scoped to a particular event and/or team.
 */
export type Grant = string | { permission: string; event?: string; team?: string; }

/**
 * Value that represents that any event will be applicable.
 */
export const kAnyEvent = '*';

/**
 * Value that represents that any team will be applicable.
 */
export const kAnyTeam = '*';

// -------------------------------------------------------------------------------------------------

/**
 * Parameters that can be passed to the constructor of the `AccessList` component.
 */
type AccessListParams = {
    /**
     * Permission group expansions that should be adhered to by the AccessList.
     */
    expansions?: Record<string, string[]>;

    /**
     * Grants that are in scope for this access list.
     */
    grants?: Grant | Grant[];

    /**
     * Events that scoped permission queries should be granted for, on top of scoped grants.
     */
    events?: string;

    /**
     * Teams that scoped permission queries should be granted for, on top of scoped grants.
     */
    teams?: string;

    /**
     * Whether the `kAnyEvent` and `kAnyTeam` qualifiers on an access check should be ignored for
     * explicitly scoped entries. Important to be able to exclude specific scopes as a revoke.
     */
    requireSpecificScope?: boolean;
};

/**
 * Scope that applies to an access entry, defining the applicable event and/or team.
 */
export type AccessScope = {
    /**
     * Event that the access query should be scoped to.
     */
    event?: string;

    /**
     * Team that the access query should be scoped to.
     */
    team?: string;
};

/**
 * Access definition for each of the grants the `AccessList` is constructed with.
 */
type Access = {
    /**
     * Whether the access was included because of an expanded permission group.
     */
    expanded: boolean;

    /**
     * Whether the access entry applies globally, or specific to a particular event and/or team.
     */
    global: boolean;

    /**
     * Scopes for which the entry is applicable, if any.
     */
    scopes?: AccessScope[];
};

/**
 * Result that will be issued from an `AccessList` query when the requested permission was found to
 * exist on the access list.
 */
export type Result = Pick<Access, 'expanded' | 'global'> & {
    /**
     * The specific scope that was determined to be applicable for the query.
     */
    scope?: 'global' | AccessScope;
};

// -------------------------------------------------------------------------------------------------

/**
 * The access list takes a sequence of grants (defined by the `Grant` type) and enables queries to
 * be ran against those grants, to understand whether they are captured by this access list. Access
 * lists can be used to track both positive grants and revokes.
 *
 * This class is an implementation detail of the `AccessControl` mechanism, and generally should not
 * be used directly. Accessors may be exposed on there to provide access when necessary.
 */
export class AccessList {
    #requireSpecificScope: boolean;

    #access: Map<string, Access> = new Map;
    #events: Set<string> = new Set;
    #teams: Set<string> = new Set;

    constructor(params?: AccessListParams) {
        this.#requireSpecificScope = !!params?.requireSpecificScope;

        if (!!params?.grants) {
            const grants = Array.isArray(params.grants) ? params.grants : [ params.grants ];

            for (const stringOrObjectGrant of grants) {
                const grant =
                    typeof stringOrObjectGrant === 'string' ? { permission: stringOrObjectGrant }
                                                            : stringOrObjectGrant;

                const seen = new Set<string>();
                const permissions = grant.permission.split(',').map(permission => ({
                    expanded: false,
                    permission,
                }));

                for (const { expanded, permission } of permissions) {
                    if (seen.has(permission))
                        continue;  // the permission has already been processed

                    seen.add(permission);

                    if (params.expansions && Object.hasOwn(params.expansions, permission)) {
                        for (const expandedPermission of params.expansions[permission])
                            permissions.push({ expanded: true, permission: expandedPermission });
                    }

                    const global = !grant.event && !grant.team;

                    if (!this.#access.has(permission))
                        this.#access.set(permission, { expanded, global });

                    const access = this.#access.get(permission)!;

                    if (access.expanded && !expanded)
                        access.expanded = false;

                    if (global) {
                        if (!access.global)
                            access.global = true;  // global access has now been granted

                        continue;
                    }

                    access.scopes ??= [ /* empty by default */ ];
                    access.scopes.push({
                        event: grant.event,
                        team: grant.team,
                    });
                }
            }
        }

        if (!!params?.events && !!params.events.length)
            this.#events = new Set<string>(params.events.split(','));

        if (!!params?.teams && !!params.teams.length)
            this.#teams = new Set<string>(params.teams.split(','));
    }

    /**
     * Gets the events that access should be granted to.
     */
    get events(): string[] { return [ ...this.#events.values() ]; }

    /**
     * Gets the teams that access should be granted to.
     */
    get teams(): string[] { return [ ...this.#teams.values() ]; }

    /**
     * Queries whether the `permission` is included in this access list, optionally with the given
     * `scope` that can further scope the check. This is a fast O(k) operation, where `k` is the
     * number of grants that were issued for the given `permission`.
     *
     * @param permission The permission to run a query for.
     * @param scope The permission scope for which the query will run.
     * @returns Result of the query, or undefined when not granted.
     */
    query(permission: string, scope?: AccessScope): Result | undefined {
        const access = this.#access.get(permission);
        if (!access)
            return undefined;

        if (!scope || (!scope.event && !scope.team)) {
            return {
                expanded: access.expanded,
                global: access.global,
            };
        }

        const globalEventAccess =
            this.#events.has(kAnyEvent) || (!!scope.event && this.#events.has(scope.event));

        const globalTeamAccess =
            this.#teams.has(kAnyTeam) || (!!scope.team && this.#teams.has(scope.team));

        if (globalEventAccess && globalTeamAccess) {
            return {
                expanded: access.expanded,
                global: access.global,
                scope: 'global',
            };
        }

        if (!!access.scopes) {
            for (const accessScope of access.scopes) {
                let global: 'global' | undefined = undefined;

                if (this.#requireSpecificScope) {
                    if (scope.event === kAnyEvent && accessScope.event !== kAnyEvent)
                        continue;
                    if (scope.team === kAnyTeam && accessScope.team !== kAnyTeam)
                        continue;
                }

                if (!!scope.event && scope.event !== kAnyEvent) {
                    if (accessScope.event !== scope.event && accessScope.event !== kAnyEvent) {
                        if (!globalEventAccess)
                            continue;

                        global = 'global';
                    }
                }

                if (!!scope.team && scope.team !== kAnyTeam) {
                    if (accessScope.team !== scope.team && accessScope.team !== kAnyTeam) {
                        if (!globalTeamAccess)
                            continue;

                        global = 'global';
                    }
                }

                return {
                    expanded: access.expanded,
                    global: access.global,
                    scope: global || accessScope,
                };
            }
        } else if (!!scope) {
            if (!!scope.event && scope.event !== kAnyEvent) {
                if (!globalEventAccess)
                    return undefined;
            }

            if (!!scope.team && scope.team !== kAnyTeam) {
                if (!globalTeamAccess)
                    return undefined;
            }

            return {
                expanded: access.expanded,
                global: access.global,
                scope: 'global',
            };
        }

        return undefined;
    }
}
