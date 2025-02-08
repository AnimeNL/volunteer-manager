// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import { SelectElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import CategoryIcon from '@mui/icons-material/Category';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';

import type { AccessDescriptor, AccessOperation } from '@lib/auth/AccessDescriptor';
import { AccessControl, kAnyEvent, kAnyTeam, type AccessControlParams, type AccessResult } from '@lib/auth/AccessControl';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Log, kLogSeverity, kLogType } from '@lib/Log';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { VolunteerPermissionsTable, type VolunteerPermissionStatus } from './VolunteerPermissionsTable';
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
 * Data associated with a volunteer permission update.
 */
const kVolunteerPermissionData = z.object({
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
 * Converts the given `input` to a list of permissions as a string. The input is expected to be
 * formatted in line with `kVolunteerPermissionData.grants`, which means a nested object with keys
 * indicating the permission status.
 *
 * @example input: { event: { applications: true, visible: false }, test: { boolean: true } }
 * @example output: event.applications,test.boolean
 */
export function toPermissionList(input: any, path?: string, permissions?: string[]): string | null {
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

            continue;
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

            toPermissionList(input[entry], `${permission}.`, permissions);
        }
    }

    if (isRoot && permissions.length > 0)
        return permissions.join(',');

    return null;
}

/**
 * Server Action called when the permissions are being updated.
 */
async function updateVolunteerPermissions(userId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kVolunteerPermissionData, async (data, props) => {
        if (!props.access.can('volunteer.account.permissions', 'update'))
            return { success: false, error: 'You are not able to update permissions' };

        let grants: string | null = null;
        if (!!data.grants)
            grants = toPermissionList(data.grants);

        let revokes: string | null = null;
        if (!!data.revokes)
            revokes = toPermissionList(data.revokes);

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
            await Log({
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
 * Props accepted by the <VolunteerPermissions> component.
 */
interface VolunteerPermissionsProps {
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
 * The <VolunteerPermissions> component displays the permissions that have been granted to the given
 * volunteer, as indicated in the `props`. The settings can be updated in real time.
 */
export async function VolunteerPermissions(props: VolunteerPermissionsProps) {
    const action = updateVolunteerPermissions.bind(null, props.userId);

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

    const permissions: VolunteerPermissionStatus[] = [ /* empty */ ];
    for (const [ name, rawDescriptor ] of Object.entries(kPermissions)) {
        const descriptor = rawDescriptor as AccessDescriptor;
        if (typeof descriptor.hide === 'boolean' && !!descriptor.hide)
            continue;  // this permission has been explicitly hidden

        const permissionChildren: VolunteerPermissionStatus[] = [];
        const permission: VolunteerPermissionStatus = {
            id: name,
            name: descriptor.name,
            description: descriptor.description,
            status: {
                account: undefined,
                roles: undefined,
            },
            warning: !!descriptor.warning,
        };

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

                const childPermission: VolunteerPermissionStatus = {
                    id: `${name}.${operation}`,
                    name: `${uppercaseFirst(operation)} ${lowercaseFirst(descriptor.name)}`,
                    status: {
                        account:
                            userAccessControl.query(crudPermission, operation, defaultOptions),
                        roles:
                            roleAccessControl.query(crudPermission, operation, defaultOptions),
                    },
                };

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

    return (
        <FormGridSection action={action} defaultValues={defaultValues}
                         icon={ <CategoryIcon color="primary" /> } title="Permissions">
            <Grid size={{ xs: 12 }}>
                <SectionIntroduction important>
                    Granting permissions to a volunteer gives them more access within the Volunteer
                    Manager. While you can also revoke permissions, it's usually best to keep that
                    to a minimum. Role-based granted access will be reflected in the permission's
                    effective status, for example because they're a Senior in a particular event.
                </SectionIntroduction>
            </Grid>

            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Global event access:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="events" label="Event access" SelectProps={{ multiple: true }}
                               options={eventsOptions} size="small" fullWidth
                               disabled={props.readOnly} />
            </Grid>

            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Global team access:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="teams" label="Team access" SelectProps={{ multiple: true }}
                               options={teamsOptions} size="small" fullWidth
                               disabled={props.readOnly} />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <VolunteerPermissionsTable permissions={permissions} readOnly={props.readOnly} />
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

        </FormGridSection>
    );
}
