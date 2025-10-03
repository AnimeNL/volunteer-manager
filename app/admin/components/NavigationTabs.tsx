// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

/**
 * Props accepted by the <NavigationTabs> component.
 */
export interface NavigationTabsProps {
    /**
     * Tabs that should be displayed as part of navigation.
     */
    tabs: {
        /**
         * Icon that should be shown on the page's tab.
         */
        icon: React.JSX.Element;

        /**
         * Label that should be shown on the page's tab.
         */
        label: string;

        /**
         * URL that should be navigated to when the page has been activated.
         */
        url: string;

        /**
         * Match to apply to the URL (or URL prefix) when deciding on highlight state. A strict
         * match is executed by default, unlike the admin's menu options.
         */
        urlMatchMode?: 'prefix' | 'strict';
    }[];
}

/**
 * The <NavigationTabs> component provides client-side navigation options designed to switch between
 * different tabs that are made available through this component's props.
 */
export function NavigationTabs(props: NavigationTabsProps) {
    const pathname = usePathname();
    const router = useRouter();

    const [ selectedTabIndex, setSelectedTabIndex ] =
        useState<number | undefined>(/* Left-most tab= */ 0);

    useEffect(() => {
        for (let index = 0; index < props.tabs.length; ++index) {
            const matchMode = props.tabs[index].urlMatchMode ?? 'strict';
            if (matchMode === 'strict' && pathname !== props.tabs[index].url)
                continue;

            if (matchMode === 'prefix' && !pathname.startsWith(props.tabs[index].url))
                continue;

            setSelectedTabIndex(index);
            break;
        }
    }, [ pathname, props.tabs ]);

    const handleChange = useCallback((event: unknown, index: number) => {
        if (index < 0 || index >= props.tabs.length)
            return;

        // Note that the `useEffect` above will take care of updating the tab bar.
        router.push(props.tabs[index].url);

    }, [ props.tabs, router ]);

    return (
        <Tabs onChange={handleChange} value={selectedTabIndex} variant="fullWidth">
            { props.tabs.map(({ label, icon }, index) =>
                <Tab key={index} icon={icon} iconPosition="start" label={label} /> )}
        </Tabs>
    );
}
