// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SelectElement } from '@components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { Grant } from '@lib/auth/AccessControl';
import type { ServerAction } from '@lib/serverAction';
import { AccessControl } from '@lib/auth/AccessControl';
import { PermissionSelector } from './PermissionSelector';
import db, {
    tEvents, tPermissionsRoles, tRoles, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { kRegistrationStatus } from '@lib/database/Types';
import { kRootRole } from './Root';

/**
 * Props accepted by the <AccountPermissionSelector> component.
 */
export interface AccountPermissionSelectorProps {
    /**
     * Access control object representing the signed in user.
     */
    access: AccessControl;

    /**
     * Server action that will be invoked when the form is submitted.
     */
    action: ServerAction;

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;

    /**
     * Unique ID of the user whose account permissions are being configured.
     */
    userId: number;
}

/**
 * The <AccountPermissionSelector> component displays the permissions that have been granted to the
 * given account, as indicated in the `props`. The settings can be updated in real time.
 */
export async function AccountPermissionSelector(props: AccountPermissionSelectorProps) {
    const dbInstance = db;
    const defaultValues: Record<string, any> = {
        events: [],
        roles: [],
        teams: [],
    };

    const roles = await dbInstance.selectFrom(tPermissionsRoles)
        .where(tPermissionsRoles.permissionRoleId.notEquals('root'))
        .select({
            id: tPermissionsRoles.permissionRoleId,
            label: tPermissionsRoles.permissionRoleName,
        })
        .orderBy(tPermissionsRoles.permissionRoleName, 'asc')
        .executeSelectMany();

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
                .and(rolesJoin.rolePermissionGrant.isNotNull())
                .and(eventsJoin.eventId.isNotNull())
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
                .and(rolesJoin.roleId.isNotNull())
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

    const grantedEvents =
        userConfiguration?.events.filter(event => !!event.event && !!event.grant) ?? [];

    const targetAccessControl =
        new AccessControl(userConfiguration?.access ?? { /* no grants */ });

    const roleGrants: Grant[] = grantedEvents.map(({ event, grant, team }) => ({
        permission: grant!,
        event,
        team,
    }));

    const roleAccessControl = new AccessControl({ grants: roleGrants });

    const rolesOptions = [ ...roles ];
    if (props.access.can('root') || targetAccessControl.can('root'))
        rolesOptions.push({ id: kRootRole.id, label: kRootRole.name });

    rolesOptions.sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

    const knownRoleIds = new Set(rolesOptions.map(role => role.id));
    knownRoleIds.add(kRootRole.id);

    const userGrants = userConfiguration?.access?.grants
        ? userConfiguration.access.grants.split(',').map(g => g.trim()).filter(Boolean)
        : [];

    defaultValues['roles'] = userGrants.filter(grant => knownRoleIds.has(grant));

    if (userConfiguration?.access?.events)
        defaultValues['events'] = userConfiguration.access.events.split(',');

    if (userConfiguration?.access?.teams)
        defaultValues['teams'] = userConfiguration.access.teams.split(',');

    const outranks = targetAccessControl.can('root') && !props.access.can('root');
    const readOnly = props.readOnly || outranks;

    const grantedEventLabels = [
        ...new Set(grantedEvents.map(({ label }) => label).filter((l): l is string => !!l)),
    ].sort();

    return (
        <PermissionSelector
            access={props.access}
            action={props.action}
            defaultValues={defaultValues}
            readOnly={readOnly}
            roleAccessControl={roleAccessControl}
            targetAccessControl={targetAccessControl}
            footer={
                !!grantedEventLabels.length &&
                <>
                    <Grid size={{ xs: 12 }}>
                        <Divider />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Alert variant="outlined" severity="info">
                            Additional role-based access has been granted based on their
                            participation in {grantedEventLabels.join(', ')}.
                        </Alert>
                    </Grid>
                </>
            }>
            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Permission roles:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="roles" label="Permission roles" options={rolesOptions}
                               size="small" fullWidth disabled={readOnly} slotProps={{
                                   select: { multiple: true },
                               }} />
            </Grid>

            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Global event access:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="events" label="Event access" options={eventsOptions}
                               size="small" fullWidth disabled={readOnly} slotProps={{
                                   select: { multiple: true },
                               }} />
            </Grid>

            <Grid size={{ xs: 2 }}>
                <Typography variant="body2" sx={{ pt: 1.25 }}>
                    Global team access:
                </Typography>
            </Grid>
            <Grid size={{ xs: 10 }}>
                <SelectElement name="teams" label="Team access" options={teamsOptions}
                               size="small" fullWidth disabled={readOnly} slotProps={{
                                   select: { multiple: true },
                               }} />
            </Grid>
        </PermissionSelector>
    );
}
