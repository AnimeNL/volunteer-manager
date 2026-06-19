// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Stack from '@mui/material/Stack';
import { paperClasses } from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

import { AdminClientContext } from '@app/admin/AdminClientContext';
import { MobileAppBar } from './MobileAppBar';
import { NavigationSidebar, type NavigationSidebarProps } from './NavigationSidebar';

/**
 * Props accepted by the responsive layout components.
 */
export interface LayoutProps {
    /**
     * Slot that contains that contents for the current page.
     */
    children: React.ReactNode;

    /**
     * Slot that contains the menu for the current section.
     */
    menu: React.ReactNode;

    /**
     * Props that should be given to specific slots part of the layout.
     */
    slotProps: {
        sidebar: Omit<NavigationSidebarProps, 'variant'>;
    };
}

/**
 * Desktop variant of the administration area layout. Composes a view in multiple vertical columns,
 * each signifying an increase in specificity and context.
 */
function DesktopLayout(props: LayoutProps) {
    return (
        <DesktopPageWrapper direction="row" spacing={1}>
            <NavigationSidebar variant="desktop" {...props.slotProps.sidebar} />
            {props.menu}
            <DesktopContentWrapper>
                {props.children}
            </DesktopContentWrapper>
        </DesktopPageWrapper>
    );
}

/**
 * Wrapper component that surrounds the page's content on desktop devices.
 */
const DesktopContentWrapper = styled(Stack)(({ theme }) => ({
    gap: theme.spacing(1.5),
    flex: 1,
    minWidth: 0,
}));

/**
 * Wrapper component that surrounds the entire page. Is a flex container, to allow child components
 * to be dynamically positioned on large screen devices.
 *
 * The first two elements are the navigation sirebar and the navigation menu, which we give a sticky
 * position so that they remain in a consistent position on the screen regardless of scrolling.
 */
const DesktopPageWrapper = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.default,
    minHeight: '100dvh',
    padding: theme.spacing(1),

    '& > :nth-child(-n + 2)': {
        position: 'sticky',
        top: '8px',
        height: 'calc(100dvh - 16px)',
    },
}));

/**
 * Mobile variant of the administration area layout. Composes a view that's similar to most powerful
 * mobile applications, which includes a top bar (without a title) and a slide-in navigation menu.
 */
function MobileLayout(props: LayoutProps) {
    return (
        <MobilePageWrapper>
            <MobileAppBar menu={props.menu} slotProps={props.slotProps} />
            <MobileContentWrapper>
                {props.children}
            </MobileContentWrapper>
        </MobilePageWrapper>
    );
}

/**
 * Wrapper component that surrounds the page's content on mobile devices.
 */
const MobileContentWrapper = styled(Stack)(({ theme }) => ({
    gap: theme.spacing(1.5),
    padding: theme.spacing(1),

    [`& > .${paperClasses.root}:first-child`]: {
        marginTop: theme.spacing(-1),
    },
}));

/**
 * Wrapper component that surrounds the entire page on mobile. Substantially easier than the view on
 * desktop, attributed to the fact that less elements will be visible on the screen.
 */
const MobilePageWrapper = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.default,
    minHeight: '100dvh',
}));

/**
 * Proxy component that picks a composition based on whether the current view should be considered
 * mobile or not, and then delegates to one of two components.
 */
export function ResponsiveLayout(props: LayoutProps) {
    const { isMobile } = useContext(AdminClientContext);
    return isMobile ? MobileLayout(props)
                    : DesktopLayout(props);
}
