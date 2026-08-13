// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { User } from '@lib/auth/User';
import { AdminHeaderEventsMenu } from './AdminHeaderEventsMenu';
import { AdminHeaderSettingsButton } from './AdminHeaderSettingsButton';
import { checkPermission } from '@lib/auth/AuthenticationContext';
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
            finished: tEvents.eventEndTime.lessOrEqual(dbInstance.currentZonedDateTime()),
        })
        .orderBy(tEvents.eventEndTime, 'desc')
        .limit(4)
        .executeSelectMany();

    const filteredEvents = unfilteredEvents.filter(event =>
        access.can('event.visible', { event: event.slug, team: kAnyTeam }));

    // ---------------------------------------------------------------------------------------------

    const canAccessOrganisationSection = checkPermission(access, kDashboardPermissions);

    return (
        <Paper>
            <Stack direction="row" spacing={2}
                   sx={{
                       alignItems: 'center',
                       backgroundColor: 'animecon.adminHeaderBackground',
                       borderTopLeftRadius: '4px',
                       borderTopRightRadius: '4px',
                       justifyContent: 'space-between',
                       paddingX: 2,
                       paddingY: 1,
                   }}>

                <Typography variant="h6" sx={{ color: 'primary.contrastText' }}>
                    AnimeCon Volunteer Manager
                </Typography>

                <Stack direction="row" spacing={2} sx={{
                    alignItems: 'center',
                }}>

                    <Typography sx={{ color: 'primary.contrastText' }}>
                        { user.displayName ?? user.firstName }
                    </Typography>

                    <AdminHeaderSettingsButton>
                        <Avatar src={user.avatarUrl}>
                            { user.name[0] }
                        </Avatar>
                    </AdminHeaderSettingsButton>

                </Stack>

            </Stack>
            <Stack direction="row" spacing={2} sx={{
                alignItems: 'center',
                padding: 1
            }}>

                <Button component={Link} href="/admin" variant="text" color="inherit">
                    Dashboard
                </Button>

                <AdminHeaderEventsMenu events={filteredEvents} />

                { canAccessOrganisationSection &&
                    <Button component={Link} href="/admin/organisation" variant="text"
                            color="inherit">
                        Organisation
                    </Button>}

            </Stack>

        </Paper>
    );
}
