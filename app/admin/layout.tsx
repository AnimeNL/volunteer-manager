// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AdminClientProviders } from './AdminClientProviders';
import { AdminHeader } from './AdminHeader';
import { Cache } from '@lib/cache';
import { MuiLicense } from '../components/MuiLicense';
import { ResponsiveLayout } from './layout/ResponsiveLayout';
import { ThemeProvider } from './layout/ThemeProvider';
import { checkPermission } from '@lib/auth/AuthenticationContext';
import { computePalette, type ColorPalette } from './layout/ThemeUtilities';
import { determineEnvironment } from '@lib/Environment';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { readUserSettings } from '@lib/UserSettings';
import db, { tEvents } from '@lib/database';

import { kDashboardPermissions } from './organisation/dashboard/DashboardPermissions';
import { kAnyTeam } from '@lib/auth/AccessList';

/**
 * URL that the user should navigate to when clicking on the build hash.
 */
const kVersionLink = 'https://github.com/beverloo/volunteer-manager';

/**
 * Layout of the administration section of the Volunteer Manager. The layout is the same for every
 * (signed in) user, although the available options will depend on the user's access level.
 */
export default async function RootAdminLayout(props: LayoutProps<'/admin'>) {
    const { access, user } = await requireAuthenticationContext({ check: 'admin' });

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const unfilteredEvents =
        await Cache.getInstance('AdminNavigationActiveEvents').getOrInsert(async () => {
            const dbInstance = db;
            return await dbInstance.selectFrom(tEvents)
                .where(tEvents.eventHidden.equals(/* false= */ 0))
                .select({
                    concluded: tEvents.eventEndTime.lessOrEqual(dbInstance.currentZonedDateTime()),
                    label: tEvents.eventShortName,
                    slug: tEvents.eventSlug,
                })
                .orderBy(tEvents.eventEndTime, 'desc')
                .executeSelectMany();
        });

    const events = unfilteredEvents!.filter(event =>
        access.can('event.visible', { event: event.slug, team: kAnyTeam }))

    const settings = await readUserSettings(user.id, [
        'admin-theme-color',
        'ai-example-messages',
        'user-admin-experimental-layout',
        'user-ai-example-messages-promo-time',
    ]);

    // Whether the new layout should be enabled. Available through context.
    const isLayoutV2 = !!settings['user-admin-experimental-layout'];

    let palette: ColorPalette | undefined;
    if (isLayoutV2)
        palette = computePalette(settings['admin-theme-color'] || '#2196f3');

    const enableOrganisation = checkPermission(access, kDashboardPermissions);

    return (
        <>
            <MuiLicense />
            <AdminClientProviders
                context={{
                    allowSilentMutations: access.can('organisation.silent'),
                    canAccessAccounts: access.can('organisation.accounts', 'read'),
                    isLayoutV2,
                }}
                enableResponsiveLayout={isLayoutV2}
                palette={environment.colours}>

                { isLayoutV2 &&
                    <ThemeProvider palette={palette!}>
                        <ResponsiveLayout
                            children={props.children}
                            menu={props.menu}
                            slotProps={{
                                sidebar: {
                                    enableOrganisation,
                                    events
                                }
                            }} />
                    </ThemeProvider> }

                { !isLayoutV2 &&
                    <Box sx={{ overflow: 'auto' }}>
                        <Box sx={{
                            backgroundColor: 'background.default',
                            minHeight: '100vh',
                            minWidth: 1280,
                            padding: 2,
                            scrollbarGutter: 'stable',
                        }}>

                            <AdminHeader access={access} user={user} settings={settings} />

                            {props.children}

                            <Typography component="footer" align="center" variant="body2"
                                        color="textPrimary" sx={{ mt: 1 }}>
                                AnimeCon Volunteer Manager (
                                <MuiLink href={kVersionLink}>{process.env.SOURCE_COMMIT}</MuiLink>)
                                — © 2015–{ (new Date()).getFullYear() }
                            </Typography>

                        </Box>
                    </Box> }

            </AdminClientProviders>
        </>
    );
}
