// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon, { listItemIconClasses } from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { NavigationItem, NavigationSection, NavigationTopLevelItem } from './NavigationItem';

/**
 * Duration, as a CSS timing unit, transitions in the menu's active state should last for.
 */
const kTransitionDuration = '0.2s';

/**
 * Props accepted by the <NavigationMenuClient> component.
 */
interface NavigationMenuClientProps {
    /**
     * Items to include in the navigation client.
     */
    items: NavigationTopLevelItem[];

    /**
     * Title of this navigation menu.
     */
    title: string;
}

/**
 * The <NavigationMenuClient> component is the client-side implementation of the menu which renders
 * it recursively, enabling nesting of the menu.
 */
export function NavigationMenuClient(props: NavigationMenuClientProps) {
    return (
        <NavigationMenuContainer>
            <NavigationMenuTitle variant="subtitle1">
                {props.title}
            </NavigationMenuTitle>
            <List dense>
                { props.items.map((item, index) =>
                    <NavigationTopLevelItemClient key={index} item={item} /> ) }
            </List>
        </NavigationMenuContainer>
    );
}

/**
 * Container for the <NavigationMenuClient> component. Sets the intrinsic dimensions.
 */
const NavigationMenuContainer = styled(Stack)(() => ({
    flexShrink: 0,
    width: '250px',
}));

/**
 * Title to be rendered at the top of a <NavigationMenuClient>.
 */
const NavigationMenuTitle = styled(Typography)(({ theme }) => ({
    color: theme.vars?.palette.text.primary,
    paddingLeft: theme.spacing(2),
    paddingTop: theme.spacing(2),
    fontWeight: 'bold',
}));

/**
 * Render component for a `NavigationTopLevelItem`, which can be one of many things.
 */
function NavigationTopLevelItemClient(props: { item: NavigationTopLevelItem }) {
    if ('header' in props.item)
        return <NavigationSectionClient section={props.item} />;

    return <NavigationItemClient item={props.item} />;
}

/**
 * Render component for a `NavigationItem`.
 */
function NavigationItemClient(props: { item: NavigationItem }) {
    return (
        <NavigationMenuListItem LinkComponent={Link} { ...{ href: props.item.href } }>
            <NavigationMenuListItemIcon>
                <props.item.Icon fontSize="small" />
            </NavigationMenuListItemIcon>
            <ListItemText>
                {props.item.label}
            </ListItemText>
            { (!!props.item.badge && typeof props.item.badge.value === 'number') &&
                <Badge badgeContent={props.item.badge.value} color={props.item.badge.severity} /> }
            { (!!props.item.badge && typeof props.item.badge.value !== 'number') &&
                <Badge variant="dot" color={ props.item.badge.severity ?? 'primary' } /> }
        </NavigationMenuListItem>
    );
}

/**
 * List item that will be shown in the navigation menu.
 */
const NavigationMenuListItem = styled(ListItemButton)(({ theme }) => ([
    {
        borderRadius: theme.vars?.shape.borderRadius,
        color: theme.vars?.palette.text.primary,
        paddingRight: theme.spacing(3.25),

        [`&:hover .${listItemIconClasses.root}`]: {
            color: theme.vars?.palette.primary.dark,
        },

        transition: theme.transitions.create('background-color', { duration: kTransitionDuration }),
    },
    theme.applyStyles('light', {
        '&:hover': {
            backgroundColor: `color-mix(in oklch, ${theme.vars?.palette.primary.main} 40%, #fff)`,
        },
    }),
    theme.applyStyles('dark', {
        '&:hover': {
            backgroundColor: `color-mix(in oklch, ${theme.vars?.palette.primary.main} 40%, #000)`,
        },
    }),
]));

/**
 * Icon part of a list icon to display in the menu. Has an adjusted minimum width to be slightly
 * denser compared to the default list rendering.
 */
const NavigationMenuListItemIcon = styled(ListItemIcon)(({ theme }) => ({
    minWidth: '36px',
    transition: theme.transitions.create('color', { duration: kTransitionDuration }),
}));

/**
 * Render component for a `NavigationSection`.
 */
function NavigationSectionClient(props: { section: NavigationSection }) {
    return (
        <>
            <NavigationSectionDivider />
            <NavigationSectionHeader>
                {props.section.header}
            </NavigationSectionHeader>
            { props.section.items.map((item, index) =>
                <NavigationTopLevelItemClient key={index} item={item} /> ) }
        </>
    );
}

/**
 * Divider to be displayed ahead of a <NavigationSectionClient>.
 */
const NavigationSectionDivider = styled(Divider)(({ theme }) => ({
    margin: theme.spacing(1.5, 2, 2, 2),
}));

/**
 * Header to be displayed as part of a <NavigationSectionClient>.
 */
const NavigationSectionHeader = styled(ListSubheader)(({ theme }) => ({
    backgroundColor: 'unset',
    fontWeight: 'normal',
    lineHeight: 'unset',

    marginBottom: theme.spacing(1),
}));
