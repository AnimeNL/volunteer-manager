// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext, useContext } from 'react';

import type SvgIcon from '@mui/material/SvgIcon';

/**
 * Props accepted by the <SectionTabContextClient> component.
 */
export interface SectionTabContextClientProps {
    /**
     * Unique ID of this tab context, to ensure uniqueness in view transitions.
     */
    id: string;

    /**
     * Tabs that should be available for the current set of pages.
     */
    tabs: {
        /**
         * Optional icon to display on the tab. May be omitted on mobile devices.
         */
        Icon?: typeof SvgIcon;

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
 * Context that makes information about the tabs available.
 */
const SectionTabContextImpl = createContext<SectionTabContextClientProps | undefined>(undefined);

/**
 * The <SectionTabContext> component represents the tabs that are available for the current set of
 * pages. It will be read by the <SectionTabs> to avoid needing repetition across pages.
 */
export function SectionTabContextClient(
    props: React.PropsWithChildren<SectionTabContextClientProps>)
{
    const { children, ...sectionTabContextProps } = props;
    return (
        <SectionTabContextImpl.Provider value={sectionTabContextProps}>
            {props.children}
        </SectionTabContextImpl.Provider>
    );
}

/**
 * Utility function through which the context provided for tabs can be obtained.
 */
export function useSectionTabContext() {
    return useContext(SectionTabContextImpl);
}
