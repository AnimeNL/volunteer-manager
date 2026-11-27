// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useState } from 'react';

import type { ExtendButtonBase } from '@mui/material/ButtonBase';
import type { ListItemButtonTypeMap } from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton, { listItemButtonClasses } from '@mui/material/ListItemButton';
import ListItemIcon, { listItemIconClasses } from '@mui/material/ListItemIcon';
import ListItemText, { listItemTextClasses } from '@mui/material/ListItemText';
import { styled } from '@mui/material/styles';

import type { ExpandableNavigationSectionId } from './NavigationActions';
import { getSchedulePath, isNavigationPathActive } from '../lib/navigationTypes';

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
     * Whether the row hosts a trailing secondary action button inside a `<ListItem>`.
     */
    hasAction?: boolean;

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
}

/**
 * Single full-pill navigation link shared across the desktop sidebar and mobile More sheet.
 */
export function NavigationLink(props: NavigationLinkProps) {
    return (
        <NavigationPill component={props.href ? Link : 'div'} hasAction={props.hasAction}
                        href={props.href} onClick={props.onClick} selected={props.selected}
                        sheet={props.sheet}>
            <ListItemIcon>
                { props.selected && props.activeIcon ? props.activeIcon : props.icon }
            </ListItemIcon>
            <ListItemText primary={props.label} slotProps={{ primary: { variant: 'body2' } }} />
        </NavigationPill>
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
 * Builds a `NavigationSubItem` with a schedule-scoped `href` and active-path check.
 */
export function createNavigationSubItem(
    eventSlug: string, relativePathname: string, path: string, key: string | number, label: string)
    : NavigationSubItem
{
    return {
        href: getSchedulePath(eventSlug, path),
        key,
        label,
        selected: isNavigationPathActive(relativePathname, path),
    };
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
}

/**
 * Collapsible navigation section with an optional indented sub-menu tree. Used for Events (areas)
 * in the desktop sidebar and Duty books in both the desktop sidebar and mobile More sheet.
 */
export function ExpandableNavigationSection(props: ExpandableNavigationSectionProps) {
    const [ expanded, setExpanded ] = useState<boolean>(props.defaultExpanded ?? false);
    if (!props.items.length) {
        return (
            <NavigationLink
                activeIcon={props.activeIcon}
                href={props.href}
                icon={props.icon}
                label={props.label}
                onClick={props.onNavigate}
                selected={props.selected}
                sheet={props.sheet} />
        );
    }

    const expandAriaLabel = `${expanded ? 'Collapse' : 'Expand'} ${props.expandLabel}`;

    function handleToggleExpanded() {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);

        updateNavigationSectionExpanded(props.sectionId, nextExpanded).catch(error =>
            console.warn(`Unable to store navigation state (${props.sectionId}): ${error}`));
    }

    return (
        <>
            <ListItem
                disablePadding
                sx={{ mb: props.sheet ? 0.5 : 0.25 }}
                secondaryAction={
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
                }>
                <NavigationLink
                    activeIcon={props.activeIcon}
                    hasAction
                    href={props.href}
                    icon={props.icon}
                    label={props.label}
                    onClick={props.onNavigate}
                    selected={props.selected}
                    sheet={props.sheet} />
            </ListItem>

            <Collapse in={expanded} unmountOnExit>
                <List disablePadding sx={{
                    borderLeft: 2,
                    borderColor: 'm3.treeLine',
                    mb: 0.5,
                    ml: '25px',
                    pl: '9px',
                }}>
                    { props.items.map(item => (
                        <NavigationPill key={item.key} component={Link} href={item.href} nested
                                        onClick={props.onNavigate} selected={item.selected}
                                        sheet={props.sheet}>
                            <ListItemText
                                primary={item.label}
                                slotProps={{ primary: { noWrap: true, variant: 'body2' } }} />
                        </NavigationPill>
                    )) }
                </List>
            </Collapse>
        </>
    );
}

/**
 * Material Design 3 full-pill navigation item shared across desktop sidebar, nested sub-menus, and
 * mobile More sheet.
 */
const NavigationPill = styled(ListItemButton, {
    shouldForwardProp: prop => prop !== 'hasAction' && prop !== 'nested' && prop !== 'sheet',
})<{ hasAction?: boolean; nested?: boolean; sheet?: boolean }>(({ theme }) => {
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

        [`& .${listItemIconClasses.root}`]: {
            color: palette.text.secondary,
        },

        [`&.${listItemButtonClasses.selected}`]: {
            backgroundColor: palette.secondary.main,
            color: palette.secondary.contrastText,
            '&:hover': {
                backgroundColor:
                    `color-mix(in srgb, ${palette.secondary.main} 88%, ` +
                    `${palette.secondary.contrastText})`,
            },
            [`& .${listItemIconClasses.root}`]: {
                color: 'inherit',
            },
            [`& .${listItemTextClasses.primary}`]: {
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
            {
                props: { hasAction: true },
                style: {
                    marginBottom: 0,
                    paddingRight: theme.spacing(5),
                },
            },
        ],
    };
}) as ExtendButtonBase<
    ListItemButtonTypeMap<{ hasAction?: boolean; nested?: boolean; sheet?: boolean }>>;

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
