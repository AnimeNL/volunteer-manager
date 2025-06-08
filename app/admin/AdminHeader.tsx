// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';

import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AccountSettings } from './organisation/accounts/[id]/settings/AccountSettings';
import type { User } from '@lib/auth/User';
import { AdminHeaderEventsMenu } from './AdminHeaderEventsMenu';
import { AdminHeaderSettingsButton } from './AdminHeaderSettingsButton';
import { checkPermission, or } from '@lib/auth/AuthenticationContext';
import { getExampleMessagesForUser } from './lib/getExampleMessagesForUser';
import { updateAccountSettings } from './organisation/accounts/[id]/AccountActions';
import db, { tEvents } from '@lib/database';

import { kAnyTeam, type AccessControl } from '@lib/auth/AccessControl';
import { kDashboardPermissions } from './organisation/dashboard/DashboardPermissions';

/**
 * Props accepted by the <AdminHeader> component.
 */
interface AdminHeaderProps {
    /**
     * Access management control, for deciding which header options are available.
     */
    access: AccessControl;

    /**
     * User settings that should be provided to the header.
     */
    settings: {
        'user-admin-experimental-dark-mode'?: boolean;
        'user-admin-experimental-responsive'?: boolean;
        'user-ai-example-messages'?: string;
    };

    /**
     * The user who is signed in to their account.
     */
    user: User;
}

/**
 * The <AdminHeader> component is a server-side component responsible for enabling the user to
 * navigate throughout the administration section, as well as providing them access to their
 * account settings.
 */
export async function AdminHeader(props: AdminHeaderProps) {
    const { access, user } = props;

    // ---------------------------------------------------------------------------------------------
    // Determine the events that can be shown in the header. The four most recent unhidden events
    // will be considered; other events can still be accessed through the regular Event overview.
    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;
    const unfilteredEvents = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventHidden.equals(/* false= */ 0))
        .select({
            shortName: tEvents.eventShortName,
            slug: tEvents.eventSlug,
            finished: tEvents.eventEndTime.lessOrEquals(dbInstance.currentZonedDateTime()),
        })
        .orderBy(tEvents.eventEndTime, 'desc')
        .limit(4)
        .executeSelectMany();

    const filteredEvents = unfilteredEvents.filter(event =>
        access.can('event.visible', { event: event.slug, team: kAnyTeam }));

    // ---------------------------------------------------------------------------------------------
    // Determine the user's settings and the action through which their settings can be updated. The
    // settings page is shared with the account system, to ensure that both pages stay in sync.
    // ---------------------------------------------------------------------------------------------

    const accountSettings: AccountSettings = {
        exampleMessages:
            await getExampleMessagesForUser(user.id, props.settings['user-ai-example-messages']),
        experimentalDarkMode: !!props.settings['user-admin-experimental-dark-mode'],
        experimentalResponsive: !!props.settings['user-admin-experimental-responsive'],
    };

    const saveSettingsFn = updateAccountSettings.bind(null, user.id);

    // ---------------------------------------------------------------------------------------------

    const canAccessOrganisationSection = checkPermission(access, kDashboardPermissions);
    const canAccessVolunteersSection = checkPermission(access, or(
        'volunteer.export',
        'volunteer.settings.shifts'
    ));

    return (
        <Paper>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}
                   sx={{
                       backgroundColor: 'primary.main',
                       borderTopLeftRadius: '4px',
                       borderTopRightRadius: '4px',
                       paddingX: 2,
                       paddingY: 1,
                   }}>

                <Typography color="primary.contrastText" variant="h6">
                    AnimeCon Volunteer Manager
                </Typography>

                <Stack direction="row" spacing={2} alignItems="center">

                    <Typography color="primary.contrastText">
                        { user.displayName ?? user.firstName }
                    </Typography>

                    <AdminHeaderSettingsButton saveSettingsFn={saveSettingsFn}
                                               settings={accountSettings}>
                        <Avatar src={user.avatarUrl}>
                            {user.firstName} {user.lastName}
                        </Avatar>
                    </AdminHeaderSettingsButton>

                </Stack>

            </Stack>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 1 }}>

                <Button component={Link} href="/admin" variant="text" color="inherit">
                    Dashboard
                </Button>

                <AdminHeaderEventsMenu events={filteredEvents} />

                { canAccessOrganisationSection &&
                    <Button component={Link} href="/admin/organisation" variant="text"
                            color="inherit">
                        Organisation
                    </Button>}

                { canAccessVolunteersSection &&
                    <Button component={Link} href="/admin/volunteers" variant="text"
                            color="inherit">
                        Stuff that needs to move
                    </Button> }

            </Stack>
        </Paper>
    );
}
