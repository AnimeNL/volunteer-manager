// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ExtendButtonBase } from '@mui/material/ButtonBase';
import type { ListItemButtonTypeMap } from '@mui/material/ListItemButton';
import BookIcon from '@mui/icons-material/Book';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import IconButton from '@mui/material/IconButton';
import InfoIcon from '@mui/icons-material/Info';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';
import NotListedLocationOutlinedIcon from '@mui/icons-material/NotListedLocationOutlined';
import { styled } from '@mui/material/styles';

import type { ExpandableNavigationSectionId } from './NavigationActions';
import type { NavigationData } from '../lib/navigationTypes';
import { getNavigationTransitionTypes, getSchedulePath,
    isNavigationPathActive } from '../lib/navigationTypes';

import { updateNavigationSectionExpanded } from './NavigationActions';

/**
 * Props accepted by the <NavigationLink> component.
 */
interface NavigationLinkProps {
    /**
     * Filled icon rendered when the item is active. Defaults to `icon`.
     */
    activeIcon?: React.ReactNode;

    /**
     * Destination URL. When omitted, renders a non-interactive placeholder item.
     */
    href?: string;

    /**
     * Default icon rendered when the item is inactive.
     */
    icon: React.ReactNode;

    /**
     * Primary label shown on the navigation row.
     */
    label: string;

    /**
     * Optional click handler (e.g. closing the mobile More sheet on navigation).
     */
    onClick?: () => void;

    /**
     * Whether this navigation item corresponds to the active route.
     */
    selected?: boolean;

    /**
     * Whether the item is rendered inside the mobile More bottom sheet (slightly taller touch
     * targets).
     */
    sheet?: boolean;

    /**
     * Directional view-transition types passed to `<Link>`.
     */
    transitionTypes?: string[];
}

/**
 * Single full-pill navigation link shared across the desktop sidebar and mobile More sheet.
 */
export function NavigationLink(props: NavigationLinkProps) {
    return (
        <NavigationItem component={props.href ? Link : 'div'} href={props.href}
                        onClick={props.onClick} selected={props.selected} sheet={props.sheet}
                        transitionTypes={props.transitionTypes}>
            <ListItemIcon>
                { props.selected && props.activeIcon ? props.activeIcon : props.icon }
            </ListItemIcon>
            <ListItemText primary={props.label} slotProps={{ primary: { variant: 'body2' } }} />
        </NavigationItem>
    );
}

/**
 * Sub-item rendered inside an <ExpandableNavigationSection>.
 */
export interface NavigationSubItem {
    href: string;
    key: string | number;
    label: string;
    selected: boolean;
}

/**
 * Props accepted by the <ExpandableNavigationSection> component.
 */
interface ExpandableNavigationSectionProps {
    activeIcon: React.ReactNode;
    defaultExpanded?: boolean;
    expandLabel: string;
    href: string;
    icon: React.ReactNode;
    items: NavigationSubItem[];
    label: string;
    onNavigate?: () => void;
    sectionId: ExpandableNavigationSectionId;
    selected: boolean;
    sheet?: boolean;
    transitionTypes?: string[];
}

/**
 * Collapsible navigation section with an optional indented sub-menu tree. Used for Events (areas)
 * in the desktop sidebar and Duty books in both the desktop sidebar and mobile More sheet.
 */
export function ExpandableNavigationSection(props: ExpandableNavigationSectionProps) {
    const [ expanded, setExpanded ] = useState<boolean>(props.defaultExpanded ?? false);
    const hasSubItems = props.items.length > 0;
    const expandAriaLabel = `${expanded ? 'Collapse' : 'Expand'} ${props.expandLabel}`;

    function handleToggleExpanded() {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);

        updateNavigationSectionExpanded(props.sectionId, nextExpanded).catch(error =>
            console.warn(`Unable to store navigation state (${props.sectionId}): ${error}`));
    }

    return (
        <>
            <ListItem disablePadding sx={{ mb: 0.5 }}
                      secondaryAction={ hasSubItems ? (
                          <ExpandButton
                              aria-expanded={expanded}
                              aria-label={expandAriaLabel}
                              edge="end"
                              expanded={expanded}
                              onClick={handleToggleExpanded}
                              sheet={props.sheet}
                              size="small">
                              <ExpandMoreIcon fontSize="small" />
                          </ExpandButton>
                      ) : undefined }>
                <NavigationItem component={Link} href={props.href} onClick={props.onNavigate}
                                selected={props.selected} sheet={props.sheet}
                                sx={hasSubItems ? { mb: 0, pr: 5 } : { mb: 0 }}
                                transitionTypes={props.transitionTypes}>
                    <ListItemIcon>
                        { props.selected ? props.activeIcon : props.icon }
                    </ListItemIcon>
                    <ListItemText primary={props.label}
                                  slotProps={{ primary: { variant: 'body2' } }} />
                </NavigationItem>
            </ListItem>

            { hasSubItems &&
                <Collapse in={expanded} unmountOnExit>
                    <SubMenuList disablePadding>
                        { props.items.map(item => (
                            <NavigationItem key={item.key} component={Link} href={item.href} nested
                                            onClick={props.onNavigate} selected={item.selected}
                                            sheet={props.sheet}
                                            transitionTypes={props.transitionTypes}>
                                <ListItemText
                                    primary={item.label}
                                    slotProps={{ primary: { noWrap: true, variant: 'body2' } }} />
                            </NavigationItem>
                        )) }
                    </SubMenuList>
                </Collapse> }
        </>
    );
}

/**
 * Props accepted by the <SecondaryNavigationItems> component.
 */
interface SecondaryNavigationItemsProps {
    data: NavigationData;
    onNavigate?: () => void;
    relativePathname: string;
    sheet?: boolean;
}

/**
 * Renders the secondary schedule routes (Duty book, Help requests, Knowledge base, and Volunteers)
 * shared between the desktop sidebar and mobile More bottom sheet.
 */
export function SecondaryNavigationItems(props: SecondaryNavigationItemsProps) {
    const { data, onNavigate, relativePathname, sheet } = props;
    const { dutyBooks, eventSlug, hasHelpRequests, hasKnowledgeBase } = data;

    const hasMultipleDutyBooks = dutyBooks.length > 1;
    const isDutyBookActive = hasMultipleDutyBooks
        ? relativePathname === '/duty-book'
        : isNavigationPathActive(relativePathname, '/duty-book');
    const dutyBookHref = hasMultipleDutyBooks
        ? getSchedulePath(eventSlug, '/duty-book')
        : getSchedulePath(eventSlug, `/duty-book/${dutyBooks[0]?.team}`);

    const dutyBookItems: NavigationSubItem[] = hasMultipleDutyBooks
        ? dutyBooks.map(entry => {
            const path = `/duty-book/${entry.team}`;
            return {
                href: getSchedulePath(eventSlug, path),
                key: entry.team,
                label: entry.name,
                selected: isNavigationPathActive(relativePathname, path),
            };
        })
        : [];

    const secondaryLinks = [
        {
            activeIcon: <NotListedLocationIcon fontSize="small" />,
            icon: <NotListedLocationOutlinedIcon fontSize="small" />,
            label: 'Help requests',
            segment: '/help-requests',
            visible: hasHelpRequests,
        },
        {
            activeIcon: <InfoIcon fontSize="small" />,
            icon: <InfoOutlinedIcon fontSize="small" />,
            label: 'Knowledge base',
            segment: '/knowledge',
            visible: hasKnowledgeBase,
        },
        {
            activeIcon: <GroupIcon fontSize="small" />,
            icon: <GroupOutlinedIcon fontSize="small" />,
            label: 'Volunteers',
            segment: '/volunteers',
            visible: true,
        },
    ];

    return (
        <>
            { dutyBooks.length > 0 &&
                <ExpandableNavigationSection
                    activeIcon={ <BookIcon fontSize="small" /> }
                    defaultExpanded={data.expandDutyBook}
                    expandLabel="duty books"
                    href={dutyBookHref}
                    icon={ <BookOutlinedIcon fontSize="small" /> }
                    items={dutyBookItems}
                    label="Duty book"
                    onNavigate={onNavigate}
                    sectionId="duty-book"
                    selected={isDutyBookActive}
                    sheet={sheet}
                    transitionTypes={
                        getNavigationTransitionTypes(relativePathname, '/duty-book')
                    } /> }

            { secondaryLinks.filter(link => link.visible).map(link => (
                <NavigationLink
                    key={link.segment}
                    activeIcon={link.activeIcon}
                    href={getSchedulePath(eventSlug, link.segment)}
                    icon={link.icon}
                    label={link.label}
                    onClick={onNavigate}
                    selected={isNavigationPathActive(relativePathname, link.segment)}
                    sheet={sheet}
                    transitionTypes={
                        getNavigationTransitionTypes(relativePathname, link.segment)
                    } />
            )) }
        </>
    );
}

/**
 * Material Design 3 full-pill navigation item shared across desktop sidebar, nested sub-menus, and
 * mobile More sheet.
 */
const NavigationItem = styled(ListItemButton, {
    shouldForwardProp: prop => prop !== 'nested' && prop !== 'sheet',
})<{ nested?: boolean; sheet?: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        borderRadius: 9999,
        color: palette.text.primary,
        marginBottom: theme.spacing(0.25),
        minHeight: 38,
        paddingBottom: theme.spacing(0.5),
        paddingTop: theme.spacing(0.5),
        transition: theme.transitions.create([ 'background-color', 'color' ], {
            duration: theme.transitions.duration.shortest,
        }),

        '& .MuiListItemIcon-root': {
            color: palette.text.secondary,
            minWidth: 36,
        },

        '&.Mui-selected': {
            backgroundColor: palette.secondary.main,
            color: palette.secondary.contrastText,
            '&:hover': {
                backgroundColor:
                    `color-mix(in srgb, ${palette.secondary.main} 88%, ` +
                    `${palette.secondary.contrastText})`,
            },
            '& .MuiListItemIcon-root': {
                color: 'inherit',
            },
            '& .MuiListItemText-primary': {
                fontWeight: 600,
            },
        },

        variants: [
            {
                props: { nested: true },
                style: {
                    color: palette.text.secondary,
                    minHeight: 32,
                    paddingBottom: theme.spacing(0.25),
                    paddingTop: theme.spacing(0.25),
                },
            },
            {
                props: { sheet: true },
                style: {
                    marginBottom: theme.spacing(0.5),
                    minHeight: 44,
                },
            },
            {
                props: { nested: true, sheet: true },
                style: {
                    marginBottom: theme.spacing(0.25),
                    minHeight: 38,
                },
            },
        ],
    };
}) as ExtendButtonBase<ListItemButtonTypeMap<{ nested?: boolean; sheet?: boolean }>>;

/**
 * Indented sub-menu list with an in-theme vertical guide line aligned under the parent icon.
 */
const SubMenuList = styled(List)(({ theme }) => ({
    borderLeft: `2px solid ${(theme.vars || theme).palette.m3.treeLine}`,
    marginBottom: theme.spacing(0.5),
    marginLeft: 25,
    paddingBottom: 0,
    paddingLeft: 9,
    paddingTop: 0,
}));

/**
 * Rotating chevron button for expanding or collapsing nested navigation sections.
 */
const ExpandButton = styled(IconButton, {
    shouldForwardProp: prop => prop !== 'expanded' && prop !== 'sheet',
})<{ expanded: boolean; sheet?: boolean }>(({ theme }) => ({
    color: 'inherit',
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(-0.5),
    opacity: 0.7,
    padding: theme.spacing(0.25),
    transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
    }),

    variants: [
        {
            props: { expanded: true },
            style: {
                transform: 'rotate(180deg)',
            },
        },
        {
            props: { sheet: true },
            style: {
                marginRight: 0,
                padding: theme.spacing(0.5),
            },
        },
    ],
}));
