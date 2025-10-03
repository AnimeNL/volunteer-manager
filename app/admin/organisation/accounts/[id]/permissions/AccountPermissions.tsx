// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { SelectElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { AccessDescriptor, AccessOperation, AccessRestriction } from '@lib/auth/AccessDescriptor';
import { AccessControl, kAnyEvent, kAnyTeam, type AccessControlParams, type AccessResult } from '@lib/auth/AccessControl';
import { AccountPermissionsTable, type AccountPermissionStatus } from './AccountPermissionsTable';
import { FormGrid } from '@app/admin/components/FormGrid';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeServerAction } from '@lib/serverAction';
import db, { tEvents, tRoles, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kPermissions, type BooleanPermission, type CRUDPermission } from '@lib/auth/Access';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Suffix to distinguish the root of nested permissions from its children. Forms are submitted in
 * declaration order, which means that "foo: true" will be overridden by "foo: { bar }".
 */
const kSelfSuffix = ':self';

/**
 * Data associated with a account permission update.
 */
const kAccountPermissionData = z.object({
    /**
     * Nested object of granted permissions. Cannot be accurately represented by Zod.
     * @example { event: { visible: true }, test: {} }
     */
    grants: z.any(),

    /**
     * Nested object of revoked permissions. Cannot be accurately represented by Zod.
     * @example { event: { visible: false }, test: { boolean: true } }
     */
    revokes: z.any(),

    /**
     * Events that the account has been explicitly granted access to.
     * @example [ "2024", "2025" ]
     */
    events: z.array(z.string()),

    /**
     * Teams that the account has been explicitly granted access to.
     * @example [ "crew", "hosts" ]
     */
    teams: z.array(z.string()),
});

/**
 * Returns whether the |restriction| is in effect based on the given |access| object.
 */
function isRestricted(restriction: AccessRestriction, access: AccessControl): boolean {
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
 * Server Action called when the permissions are being updated.
 */
async function updateAccountPermissions(userId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kAccountPermissionData, async (data, props) => {
        if (!props.access.can('organisation.permissions', 'update'))
            return { success: false, error: 'You are not able to update permissions' };

        const existingAccessInfo = await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(userId))
            .select({
                id: tUsers.userId,  // to ensure that an object is returned

                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            })
            .executeSelectNoneOrOne();

        if (!existingAccessInfo)
            notFound();

        const existingAccess = new AccessControl(existingAccessInfo);
        if (existingAccess.can('root') && !props.access.can('root'))
            return { success: false, error: 'You are not allowed to update these permissions…' };

        let grants: string | null = null;
        let revokes: string | null = null;

        try {
            if (!!data.grants)
                grants = toPermissionList(data.grants, props.access, existingAccess);

            if (!!data.revokes)
                revokes = toPermissionList(data.revokes, props.access, existingAccess);

        } catch (error: any) {
            return { success: false, error: error.message };
        }

        let events: string | null = null;
        if (!!data.events.length)
            events = data.events.includes(kAnyEvent) ? kAnyEvent : data.events.join(',');

        let teams: string | null = null;
        if (!!data.teams.length)
            teams = data.teams.includes(kAnyTeam) ? kAnyTeam : data.teams.join(',');

        const affectedRows = await db.update(tUsers)
            .set({
                permissionsGrants: grants,
                permissionsRevokes: revokes,
                permissionsEvents: events,
                permissionsTeams: teams,
            })
            .where(tUsers.userId.equals(userId))
            .executeUpdate();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminUpdatePermission,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                targetUser: userId,
                data: {
                    ip: props.ip,
                    grants, revokes, events, teams,
                }
            });
        } else {
            return { success: false, error: 'Unable to update permissions in the database…' };
        }

        return {
            success: true,
            refresh: true,
        };
    });
}

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
 * Decides whether the 'current' should be upgraded into the `child` permission status. This is
 * only the case when the `child` status is less specific than the given `current` status.
 */
function maybeUpgradePermissionStatus(
    current: AccessResult | 'partial' | undefined, child: AccessResult | 'partial' | undefined)
        : AccessResult | 'partial' | undefined
{
    if (!current && child && child !== 'partial') {
        if (child.expanded || child.result === 'granted')
            return child;
    } else if (current && current !== 'partial' && child) {
        if (child === 'partial' || child.result === 'revoked')
            return 'partial';
    }

    return current;
}

/**
 * Props accepted by the <AccountPermissions> component.
 */
interface AccountPermissionsProps {
    /**
     * Access control object representing the signed in user.
     */
    access: AccessControl;

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;

    /**
     * Unique ID of the user for whom permissions are being shown.
     */
    userId: number;
}

/**
 * The <AccountPermissions> component displays the permissions that have been granted to the given
 * account, as indicated in the `props`. The settings can be updated in real time.
 */
export async function AccountPermissions(props: AccountPermissionsProps) {
    const action = updateAccountPermissions.bind(null, props.userId);

    const dbInstance = db;
    const defaultValues: Record<string, any> = {
        events: [ /* empty */ ],
        teams: [ /* empty */ ],
    };

    // ---------------------------------------------------------------------------------------------

    const events = await dbInstance.selectFrom(tEvents)
        .select({
            id: tEvents.eventSlug,
            label: tEvents.eventSlug,
        })
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectMany();

    const eventsOptions = [
        { id: kAnyEvent, label: 'All events' },
        ...events,
    ];

    const teams = await dbInstance.selectFrom(tTeams)
        .select({
            id: tTeams.teamSlug,
            label: tTeams.teamName,
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    const teamsOptions = [
        { id: kAnyTeam, label: 'All teams' },
        ...teams,
    ];

    // ---------------------------------------------------------------------------------------------

    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const userConfiguration = await dbInstance.selectFrom(tUsers)
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
        .where(tUsers.userId.equals(props.userId))
        .select({
            access: {
                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            },
            events: dbInstance.aggregateAsArray({
                event: eventsJoin.eventSlug,
                grant: rolesJoin.rolePermissionGrant,
                label: eventsJoin.eventShortName,
                team: teamsJoin.teamSlug,
            }),
        })
        .groupBy(tUsers.userId)
        .executeSelectNoneOrOne();

    if (!!userConfiguration?.events)
        userConfiguration.events = userConfiguration.events.filter(event => !!event.event);

    const userAccessControl = new AccessControl(userConfiguration?.access ?? { /* no grants */ });

    const roleGrants: AccessControlParams = { grants: [], revokes: [] };
    if (!!userConfiguration) {
        for (const { event, grant, team } of userConfiguration?.events) {
            if (!grant || !Array.isArray(roleGrants.grants))
                continue;  // no grants are part of this participation

            roleGrants.grants.push({
                permission: grant,
                event,
                team,
            });
        }
    }

    const roleAccessControl = new AccessControl(roleGrants);

    // ---------------------------------------------------------------------------------------------

    if (userConfiguration?.access?.events)
        defaultValues['events'] = userConfiguration.access.events.split(',');

    if (userConfiguration?.access?.teams)
        defaultValues['teams'] = userConfiguration.access.teams.split(',');

    // ---------------------------------------------------------------------------------------------

    const defaultOptions = {
        event: kAnyEvent,
        team: kAnyTeam,
    };

    const permissions: AccountPermissionStatus[] = [ /* empty */ ];
    for (const [ name, rawDescriptor ] of Object.entries(kPermissions)) {
        const descriptor = rawDescriptor as AccessDescriptor;
        if (typeof descriptor.hide === 'boolean' && !!descriptor.hide)
            continue;  // this permission has been explicitly hidden

        const permissionChildren: AccountPermissionStatus[] = [];
        const permission: AccountPermissionStatus = {
            id: name,
            name: descriptor.name,
            description: descriptor.description,
            status: {
                account: undefined,
                roles: undefined,
            },
            warning: !!descriptor.warning,
        };

        if (typeof descriptor.restrict === 'string')
            permission.restricted = isRestricted(descriptor.restrict, props.access);

        if (descriptor.type === 'boolean') {
            const booleanPermission = name as BooleanPermission;

            permission.status.account =
                userAccessControl.query(booleanPermission, defaultOptions);
            permission.status.roles =
                roleAccessControl.query(booleanPermission, defaultOptions);

            if (permission.status.account?.expanded === false) {
                if (permission.status.account.result === 'granted')
                    defaultValues[`grants[${name}]`] = true;
                else
                    defaultValues[`revokes[${name}]`] = true;
            }

        } else if (descriptor.type === 'crud') {
            const crudPermission = name as CRUDPermission;

            permission.suffix = kSelfSuffix;  // avoids overwriting values when submitting the form

            for (const rawOperation of [ 'create', 'read', 'update', 'delete' ]) {
                const operation = rawOperation as AccessOperation;

                if (!!descriptor.hide && descriptor.hide.includes(operation))
                    continue;  // this operation has been explicitly hidden

                const childPermission: AccountPermissionStatus = {
                    id: `${name}.${operation}`,
                    name: `${uppercaseFirst(operation)} ${lowercaseFirst(descriptor.name)}`,
                    restricted: !!permission.restricted,
                    status: {
                        account:
                            userAccessControl.query(crudPermission, operation, defaultOptions),
                        roles:
                            roleAccessControl.query(crudPermission, operation, defaultOptions),
                    },
                };

                if (typeof descriptor.restrict === 'object' && operation in descriptor.restrict) {
                    if (!!descriptor.restrict[operation]) {
                        childPermission.restricted =
                            isRestricted(descriptor.restrict[operation], props.access);
                    }
                }

                permission.status.account = maybeUpgradePermissionStatus(
                    permission.status.account, childPermission.status.account);

                permission.status.roles = maybeUpgradePermissionStatus(
                    permission.status.roles, childPermission.status.roles);

                if (typeof childPermission.status.account === 'object' &&
                        (childPermission.status.account.expanded === false ||
                         childPermission.status.account.crud === false))
                {
                    if (childPermission.status.account.result === 'granted') {
                        if (childPermission.status.account.crud)
                            defaultValues[`grants[${name}.${operation}]`] = true;
                        else
                            defaultValues[`grants[${name}${kSelfSuffix}]`] = true;

                    } else {
                        if (childPermission.status.account.crud)
                            defaultValues[`revokes[${name}.${operation}]`] = true;
                        else
                            defaultValues[`revokes[${name}${kSelfSuffix}]`] = true;
                    }
                }

                permissionChildren.push(childPermission);
            }
        } else {
            throw new Error(`Unhandled permission type: "${descriptor.type}"`);
        }

        permissions.push(permission, ...permissionChildren);
    }

    // ---------------------------------------------------------------------------------------------

    const outranks = userAccessControl.can('root') && !props.access.can('root');
    const readOnly = props.readOnly || outranks;

    return (
        <FormGrid action={action} defaultValues={defaultValues}>
            <Grid size={{ xs: 12 }}>
                <SectionIntroduction important>
                    Granting permissions to a account gives them more access within the Volunteer
                    Manager. While you can also revoke permissions, it's usually best to keep that
                    to a minimum. Role-based granted access will be reflected in the permission's
                    effective status, for example because they're a Senior in a particular event.
                </SectionIntroduction>
            </Grid>

            { outranks &&
                <Grid size={{ xs: 12 }}>
                    <Alert severity="error">
                        This account has higher permissions than yours, so you won't be able to
                        change their permission settings.
                    </Alert>
                </Grid> }

            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Global event access:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="events" label="Event access" SelectProps={{ multiple: true }}
                               options={eventsOptions} size="small" fullWidth
                               disabled={readOnly} />
            </Grid>

            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Global team access:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="teams" label="Team access" SelectProps={{ multiple: true }}
                               options={teamsOptions} size="small" fullWidth
                               disabled={readOnly} />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <AccountPermissionsTable permissions={permissions} readOnly={readOnly} />
            </Grid>

            { !!userConfiguration?.events.length &&
                <>
                    <Grid size={{ xs: 12 }}>
                        <Divider />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Alert variant="outlined" severity="info">
                            Additional role-based access has been granted based on their
                            participation in{' '}
                            {userConfiguration.events.map(({ label }) => label ).sort().join(', ')}.
                        </Alert>
                    </Grid>
                </> }

        </FormGrid>
    );
}
