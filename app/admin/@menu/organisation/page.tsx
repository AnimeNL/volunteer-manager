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
    const { access } = await requireAuthenticationContext();
    return (
        <NavigationMenu access={access} title="Organisation" items={[
            {
                Icon: DashboardOutlinedIcon,
                label: 'Dashboard',
                url: '/admin/organisation',
                urlMatchMode: 'strict',
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
            {
                defaultExpanded: true,
                header: 'People',
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
                ],
            },
            {
                defaultExpanded: true,
                header: 'Services',
                items: [
                    {
                        Icon: ShareIcon,
                        label: 'Data exports',
                        permission: 'organisation.exports',
                        url: '/admin/organisation/exports/create',
                        urlPrefix: '/admin/organisation/exports',
                    },
                    {
                        Icon: TipsAndUpdatesIcon,
                        label: 'Del a Rie Advies',
                        permission: 'organisation.nardo',
                        url: '/admin/organisation/nardo',
                    },
                    {
                        Icon: TabletIcon,
                        label: 'Displays',
                        permission: 'organisation.displays',
                        url: '/admin/organisation/displays',
                    },
                ],
            },
        ]} />
    );
}
