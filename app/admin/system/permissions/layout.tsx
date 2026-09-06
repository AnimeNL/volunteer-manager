// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AutoAwesomeMotionOutlinedIcon from '@mui/icons-material/AutoAwesomeMotionOutlined';
import KeyIcon from '@mui/icons-material/Key';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The <PermissionsLayout> provides tab navigation between the principals, permissions and roles
 * that are configured in the system.
 */
export default async function PermissionsLayout(
    props: LayoutProps<'/admin/system/permissions'>)
{
    const { access } = await requireAuthentication('system.permissions');
    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: PersonOutlinedIcon,
                label: 'Principals',
                url: '/admin/system/permissions/principals',
                urlMatchMode: 'prefix',
            },
            {
                Icon: KeyIcon,
                label: 'Permissions',
                url: '/admin/system/permissions/permissions',
                urlMatchMode: 'prefix',
            },
            {
                Icon: AutoAwesomeMotionOutlinedIcon,
                label: 'Roles',
                url: '/admin/system/permissions/roles',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
