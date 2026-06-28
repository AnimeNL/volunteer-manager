// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

import Tab, { tabClasses } from '@mui/material/Tab';
import Tabs, { tabsClasses } from '@mui/material/Tabs';
import { styled } from '@mui/material/styles';

import { useIsMobile } from '@app/admin/lib/useIsMobile';
import { useSectionTabContext } from './SectionTabContextClient';

/**
 * The <SectionTabs> component represents a tab bar to show at the top of a regular <Section>,
 * through which the user can navigate between different pages. It requires <SectionTabContext> to
 * be in the hierarchy in order to decide which tabs should be displayed.
 */
export function SectionTabs() {
    const isMobile = useIsMobile();

    const pathname = usePathname();

    const context = useSectionTabContext();
    if (!context)
        return null;

    let selectedTabIndex = 0;

    for (let index = 0; index < context.tabs.length; ++index) {
        const matchMode = context.tabs[index].urlMatchMode ?? 'strict';
        if (matchMode === 'strict' && pathname !== context.tabs[index].url)
            continue;

        if (matchMode === 'prefix' && !pathname.startsWith(context.tabs[index].url))
            continue;

        selectedTabIndex = index;
        break;
    }

    return (
        <StyledTabContainer>
            <ViewTransition name={`section-tabs-${context.id}`}>
                <StyledTabs variant={ isMobile ? 'scrollable' : 'fullWidth' }
                            value={selectedTabIndex} allowScrollButtonsMobile>
                    { context.tabs.map(tab =>
                        <Tab key={tab.url} LinkComponent={Link} href={tab.url}
                             label={tab.label}
                             iconPosition="start" icon={
                                 !!tab.Icon ? <tab.Icon fontSize="small" />
                                            : undefined
                             } /> ) }
                </StyledTabs>
            </ViewTransition>
        </StyledTabContainer>
    );
}

/**
 * Styled container that holds the tabs. Removes margins in order for the tab bar to be full width.
 */
const StyledTabContainer = styled('div')(({ theme }) => ({
    margin: `${theme.spacing(-2, -2, 0)} !important`,
}));

/**
 * Styled variant of MUI's <Tabs> component to provide some visual distinction.
 */
const StyledTabs = styled(Tabs)(({ theme }) => ({
    borderTopLeftRadius: theme.shape.borderRadius,
    borderTopRightRadius: theme.shape.borderRadius,
    borderBottom: `1px solid ${theme.vars?.palette.divider}`,

    [`& .${tabClasses.root}`]: {
        flexGrow: 1,
    },

    [`& .${tabsClasses.scrollButtons}.Mui-disabled`]: {
        opacity: 0.3,
    },
}));
