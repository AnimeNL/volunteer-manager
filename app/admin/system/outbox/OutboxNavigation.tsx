// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

/**
 * The <OutboxNavigation> component displays a tab-like bar at the top of the Outbox page, which
 * enables the volunteer to navigate between outboxes of different communication channels.
 */
export function OutboxNavigation() {
    const pathname = usePathname();
    const router = useRouter();

    const navigationOptions = useMemo(() => ([
        {
            label: 'E-mail',
            icon: <MailOutlinedIcon />,
            url: '/admin/system/outbox/email'
        },
        {
            label: 'SMS',
            icon: <TextsmsOutlinedIcon />,
            url: '/admin/system/outbox/sms',
        },
        {
            label: 'WhatsApp',
            icon: <WhatsAppIcon />,
            url: '/admin/system/outbox/whatsapp'
        },
    ]), [ /* no dependencies */ ]);

    const [ selectedTabIndex, setSelectedTabIndex ] =
        useState<number | undefined>(/* E-mail= */ 0);

    useEffect(() => {
        for (let index = 0; index < navigationOptions.length; ++index) {
            if (!pathname.startsWith(navigationOptions[index].url))
                continue;

            setSelectedTabIndex(index);
            break;
        }
    }, [ navigationOptions, pathname ]);

    const handleChange = useCallback((event: unknown, index: number) => {
        if (index < 0 || index > navigationOptions.length)
            return;

        // Note that the `useEffect` above will take care of updating the tab bar.
        router.push(navigationOptions[index].url);

    }, [ navigationOptions, router ]);

    return (
        <Tabs onChange={handleChange} value={selectedTabIndex} variant="fullWidth">
            { navigationOptions.map(({ label, icon }, index) =>
                <Tab key={index} icon={icon} iconPosition="start" label={label} /> )}
        </Tabs>
    );
}
