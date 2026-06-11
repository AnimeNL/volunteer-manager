// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import Badge from '@mui/material/Badge';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
        <NavigationMenuListItem LinkComponent={Link} { ...{ href: props.item.href } }
                                className={ props.item.active ? 'active' : undefined }>
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

        [`&:hover .${listItemIconClasses.root}, &.active .${listItemIconClasses.root}`]: {
            color: theme.vars?.palette.primary.dark,
        },

        transition: theme.transitions.create('background-color', { duration: kTransitionDuration }),
    },
    theme.applyStyles('light', {
        '&:hover, &.active': {
            backgroundColor: `color-mix(in oklch, ${theme.vars?.palette.primary.main} 40%, #fff)`,
        },
    }),
    theme.applyStyles('dark', {
        '&:hover, &.active': {
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
    const [ collapsed, setCollapsed ] = useState<boolean>(!!props.section.defaultExpanded);

    const handleToggleCollapsed = useCallback(() => {
        setCollapsed(state => !state);
    }, [ /* no deps */ ]);

    return (
        <>
            <NavigationSectionDivider />
            <NavigationSectionHeader direction="row" onClick={handleToggleCollapsed}>
                <NavigationSectionHeaderText>
                    {props.section.header}
                </NavigationSectionHeaderText>
                <ExpandMoreIcon className={ collapsed ? 'collapsed' : '' } color="action"
                                fontSize="small" />
            </NavigationSectionHeader>
            <Collapse in={collapsed}>
                <NavigationSectionContentAnimation>
                    { props.section.items.map((item, index) =>
                        <NavigationTopLevelItemClient key={index} item={item} /> ) }
                </NavigationSectionContentAnimation>
            </Collapse>
        </>
    );
}

/**
 * Animation to apply to the content a navigation section when its visibility changes.
 */
const NavigationSectionContentAnimation = styled('div')(({ theme }) => ({
    transform: 'translateX(8px)',
    opacity: 0,

    '.MuiCollapse-entered &': {
        transform: 'translateX(0px)',
        opacity: 1,
    },

    // TODO: The exit animation is great, the enter animation is delayed too much.
    transition: theme.transitions.create([ 'opacity', 'transform' ]),
}));

/**
 * Divider to be displayed ahead of a <NavigationSectionClient>.
 */
const NavigationSectionDivider = styled(Divider)(({ theme }) => ({
    margin: theme.spacing(1.5, 2, 2, 2),
}));

/**
 * Header to be displayed as part of a <NavigationSectionClient>.
 */
const NavigationSectionHeader = styled(Stack)(({ theme }) => ({
    cursor: 'pointer',
    paddingRight: theme.spacing(2),

    '& svg.collapsed': { transform: 'rotate(180deg)' },
    '& svg': { transition: theme.transitions.create('transform') },
}));

/**
 * Text on the header to be displayed as part of a <NavigationSectionClient>.
 */
const NavigationSectionHeaderText = styled(ListSubheader)(({ theme }) => ({
    backgroundColor: 'unset',
    flexGrow: 1,
    fontWeight: 'normal',
    lineHeight: 'unset',

    marginBottom: theme.spacing(1),
}));
