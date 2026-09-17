// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import PersonIcon from '@mui/icons-material/Person';
import ShareIcon from '@mui/icons-material/Share';
import TabletIcon from '@mui/icons-material/Tablet';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';

import { Cache } from '@lib/cache';
import { NavigationMenu } from '../../layout/NavigationMenu';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tDisplays, tFeedback } from '@lib/database';

/**
 * This variant of the parallel route composes the menu for the Organisation section of our app. It
 * will be independently updated from the rest of the content.
 */
export default async function OrganisationMenu() {
    const { access, user } = await requireAuthentication();

    let badges: Record<string, number> = {
        displays: 0,
        feedback: 0,
    };

    if (access.can('organisation.displays') || access.can('organisation.feedback')) {
        const exactlyOneDayAgo = Temporal.Now.zonedDateTimeISO().subtract({ days: 1 });

        const cache = Cache.getInstance('AdminNavigationMenuCache');
        const counts = await cache.getOrInsert('organisation', async () => {
            const dbInstance = db;

            const displaysValue = dbInstance.selectFrom(tDisplays)
                .where(tDisplays.displayCheckIn.greaterOrEqual(exactlyOneDayAgo))
                    .and(tDisplays.displayDeleted.isNull())
                .selectCountAll()
                .forUseAsInlineQueryValue();

            const feedbackValue = dbInstance.selectFrom(tFeedback)
                .where(tFeedback.feedbackResponse.isNull())
                .selectCountAll()
                .forUseAsInlineQueryValue();

            return await dbInstance.selectFromNoTable()
                .select({
                    displays: displaysValue,
                    feedback: feedbackValue,
                })
                .executeSelectOne();
        });

        if (counts)
            badges = { ...badges, ...counts };
    }

    return (
        <NavigationMenu access={access} id="organisation" title="Organisation" items={[
            {
                Icon: DashboardOutlinedIcon,
                label: 'Dashboard',
                url: '/admin/organisation',
                urlMatchMode: 'strict',
            },
            {
                Icon: ShareIcon,
                label: 'Data exports',
                permission: 'organisation.exports',
                url: '/admin/organisation/exports/create',
                urlPrefix: '/admin/organisation/exports',
            },
            {
                defaultExpanded: true,
                header: 'People & teams',
                id: 'people',
                items: [
                    {
                        Icon: PersonIcon,
                        label: 'Accounts',
                        permission: {
                            permission: 'organisation.accounts',
                            operation: 'read',
                        },
                        url: '/admin/organisation/accounts',
                    },
                    {
                        Icon: FeedbackOutlinedIcon,
                        badge: {
                            severity: 'warning',
                            value: badges.feedback,
                        },
                        label: 'Feedback',
                        permission: 'organisation.feedback',
                        url: '/admin/organisation/feedback',
                    },
                    {
                        Icon: AccountBalanceIcon,
                        label: 'Structure',
                        permission: [
                            { permission: 'organisation.environments', operation: 'read' },
                            { permission: 'organisation.roles', operation: 'read' },
                            { permission: 'organisation.teams', operation: 'read' },
                        ],
                        url: '/admin/organisation/structure',
                    },
                ],
            },
            {
                defaultExpanded: true,
                header: 'Services',
                id: 'services',
                items: [
                    {
                        Icon: TipsAndUpdatesOutlinedIcon,
                        label: 'Del a Rie Advies',
                        permission: 'organisation.nardo',
                        url: '/admin/organisation/nardo',
                    },
                    {
                        Icon: TabletIcon,
                        badge: {
                            severity: 'success',
                            value: badges.displays,
                        },
                        label: 'Displays',
                        permission: 'organisation.displays',
                        url: '/admin/organisation/displays',
                    },
                ],
            },
        ]} userId={user.id} />
    );
}
