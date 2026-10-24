// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Layout for the outbox page. Several tabs are shown displaying the outgoing messages over a set
 * of channels, including e-mail, WhatsApp and Web Push Notifications.
 */
export default async function OutboxLayout(props: LayoutProps<'/admin/system/outbox'>) {
    const { access } = await requireAuthentication('system.internals.outbox');

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: MailOutlinedIcon,
                label: 'E-mail',
                url: '/admin/system/outbox/email',
                urlMatchMode: 'prefix',
            },
            {
                Icon: TextsmsOutlinedIcon,
                label: 'SMS',
                url: '/admin/system/outbox/sms',
                urlMatchMode: 'prefix',
            },
            {
                Icon: WhatsAppIcon,
                label: 'WhatsApp',
                url: '/admin/system/outbox/whatsapp',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
