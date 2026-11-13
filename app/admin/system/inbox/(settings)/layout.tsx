// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EmailIcon from '@mui/icons-material/Email';
import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { or, requireAuthentication } from '@lib/requireAuthentication';

/**
 * The <InboxSettingsLayout> provides tab navigation between the configured e-mail accounts and
 * explicit volunteer inbox permissions.
 */
export default async function InboxSettingsLayout(props: LayoutProps<'/admin/system/inbox'>) {
    const { access } = await requireAuthentication(or(
        'system.inbox.management',
        'system.integrations',
    ));

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: EmailIcon,
                label: 'Accounts',
                permission: 'system.integrations',
                url: '/admin/system/inbox/accounts',
                urlMatchMode: 'prefix',
            },
            {
                Icon: LockPersonOutlinedIcon,
                label: 'Permissions',
                permission: 'system.inbox.management',
                url: '/admin/system/inbox/permissions',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
