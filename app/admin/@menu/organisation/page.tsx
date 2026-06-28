// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CategoryIcon from '@mui/icons-material/Category';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import PersonIcon from '@mui/icons-material/Person';
import ShareIcon from '@mui/icons-material/Share';
import TabletIcon from '@mui/icons-material/Tablet';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';

import { NavigationMenu } from '../../layout/NavigationMenu';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * This variant of the parallel route composes the menu for the Organisation section of our app. It
 * will be independently updated from the rest of the content.
 */
export default async function OrganisationMenu() {
    const { access, user } = await requireAuthenticationContext({ check: 'admin' });
    return (
        <NavigationMenu access={access} id="organisation" title="Organisation" items={[
            {
                Icon: DashboardOutlinedIcon,
                badge: { severity: 'warning', value: true },  // migration in progress
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
                        badge: { severity: 'warning', value: true },  // migration in progress
                        label: 'Accounts',
                        permission: {
                            permission: 'organisation.accounts',
                            operation: 'read',
                        },
                        url: '/admin/organisation/accounts',
                    },
                    {
                        Icon: FeedbackOutlinedIcon,
                        badge: { severity: 'warning', value: true },  // migration in progress
                        label: 'Feedback',
                        permission: 'organisation.feedback',
                        url: '/admin/organisation/feedback',
                    },
                    {
                        Icon: CategoryIcon,
                        label: 'Permissions',
                        permission: {
                            permission: 'organisation.permissions',
                            operation: 'read',
                        },
                        url: '/admin/organisation/permissions',
                    },
                    {
                        Icon: AccountBalanceIcon,
                        label: 'Structure',
                        permission: [
                            'organisation.environments',
                            'organisation.roles',
                            'organisation.teams',
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
                        Icon: TipsAndUpdatesIcon,
                        label: 'Del a Rie Advies',
                        permission: 'organisation.nardo',
                        url: '/admin/organisation/nardo',
                    },
                    {
                        Icon: TabletIcon,
                        badge: { severity: 'warning', value: true },  // migration in progress
                        label: 'Displays',
                        permission: 'organisation.displays',
                        url: '/admin/organisation/displays',
                    },
                ],
            },
        ]} userId={user.id} />
    );
}
