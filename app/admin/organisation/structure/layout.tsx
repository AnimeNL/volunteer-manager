// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import GroupsIcon from '@mui/icons-material/Groups';
import PublicIcon from '@mui/icons-material/Public';
import WorkOutlinedIcon from '@mui/icons-material/WorkOutlined';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The <OrganisationEntitiesLayout> is the core layout that provides tab navigation between the
 * teams, environments and roles that exist within our organisation.
 */
export default async function OrganisationEntitiesLayout(
    props: LayoutProps<'/admin/organisation/structure'>)
{
    const { access } = await requireAuthentication();
    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: GroupsIcon,
                label: 'Teams',
                permission: 'organisation.teams',
                url: '/admin/organisation/structure',
                urlMatchMode: 'strict',
            },
            {
                Icon: PublicIcon,
                label: 'Environments',
                permission: 'organisation.environments',
                url: '/admin/organisation/structure/environments',
                urlMatchMode: 'prefix',
            },
            {
                Icon: WorkOutlinedIcon,
                label: 'Roles',
                permission: 'organisation.roles',
                url: '/admin/organisation/structure/roles',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
