// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { AdminClientProviders } from './AdminClientProviders';
import { Cache } from '@lib/cache';
import { MuiLicense } from '../components/MuiLicense';
import { ResponsiveLayout } from './layout/ResponsiveLayout';
import { checkPermission } from '@lib/auth/AuthenticationContext';
import { computePalette } from './layout/ThemeUtilities';
import { determineEnvironment } from '@lib/Environment';
import { readUserSettings } from '@lib/UserSettings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents } from '@lib/database';

import { kDashboardPermissions } from './organisation/dashboard/DashboardPermissions';
import { kAnyTeam } from '@lib/auth/AccessList';

/**
 * Layout of the administration section of the Volunteer Manager. The layout is the same for every
 * (signed in) user, although the available options will depend on the user's access level.
 */
export default async function RootAdminLayout(props: LayoutProps<'/admin'>) {
    const { access, user } = await requireAuthentication();

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
        'user-ai-example-messages-promo-time',
    ]);

    const enableOrganisation = checkPermission(access, kDashboardPermissions);

    const palette = computePalette(settings['admin-theme-color'] || '#2196f3');

    return (
        <>
            <MuiLicense />
            <AdminClientProviders
                palette={palette}
                context={{
                    allowSilentMutations: access.can('organisation.silent'),
                    canAccessAccounts: access.can('organisation.accounts', 'read'),
                }}>

                <ResponsiveLayout
                    children={props.children}
                    menu={props.menu}
                    slotProps={{
                        sidebar: {
                            enableOrganisation,
                            events
                        }
                    }} />

            </AdminClientProviders>
        </>
    );
}
