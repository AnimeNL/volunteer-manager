// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';

import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventIcon from '@mui/icons-material/Event';
import GroupsIcon from '@mui/icons-material/Groups';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem, { type MenuItemProps } from '@mui/material/MenuItem';
import { styled } from '@mui/material/styles';

import { SidebarButton } from './SidebarButton';
import { useIsMobile } from '../lib/useIsMobile';

/**
 * Props accepted by the <SidebarVolunteersButton> component.
 */
export interface SidebarVolunteersButtonProps {
    /**
     * Whether the volunteers button is the active item in the sidebar.
     */
    active: boolean;

    /**
     * List of active events for which volunteer management is available.
     */
    events: {
        /**
         * Whether the event has concluded already.
         */
        concluded: boolean;

        /**
         * Label that succinctly describes an event.
         */
        label: string;

        /**
         * URL-safe slug used to refer to the event.
         */
        slug: string;

    }[];
}

/**
 * The <SidebarVolunteersButton> is a component that provides access to the volunteer management
 * functionality for a particular event.
 */
export function SidebarVolunteersButton(props: SidebarVolunteersButtonProps) {
    const isMobile = useIsMobile();

    const [ anchorElement, setAnchorElement ] = useState<HTMLElement | null>(null);

    const handleMenuClose = useCallback(() => setAnchorElement(null), [ /* no deps */ ]);
    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorElement(event.currentTarget);
    }, [ /* no deps */ ]);

    return (
        <>
            <SidebarButton Icon={GroupsIcon} active={props.active}
                           onClick={handleMenuOpen} title="Volunteers" />
            <Menu anchorEl={anchorElement} open={!!anchorElement} onClose={handleMenuClose}
                  transformOrigin={ isMobile ? { horizontal: 'center', vertical: -4 } : undefined }
                  anchorOrigin={ isMobile ? { horizontal: 'center', vertical: 'bottom' }
                                          : { horizontal: 'right', vertical: 'top' } }>
                    <MenuHeader>
                        <ListItemText primary="Volunteers" />
                    </MenuHeader>
                { !props.events.length &&
                    <MenuItem dense>
                        <ListItemIcon>
                            <EventBusyIcon />
                        </ListItemIcon>
                        <ListItemText primary="No events available…" />
                    </MenuItem> }
                { props.events.map(event =>
                    <MenuItem key={event.slug} dense sx={{ pr: 3 }} component={Link}
                              href={ `/admin/events/${event.slug}` } onClick={handleMenuClose}>
                        <ListItemIcon>
                            { !event.concluded && <EventIcon color="primary" /> }
                            { !!event.concluded && <EventAvailableIcon color="disabled" /> }
                        </ListItemIcon>
                        <ListItemText primary={event.label} />
                    </MenuItem> ) }
            </Menu>
        </>
    );
}

/**
 * Tooltip used to illustrate what the particular button will be used for. Will be displayed on the
 * right-hand side of the button in a dark variant of the primary theme colour.
 */
const MenuHeader = styled(({ className, ...props }: MenuItemProps) => (
     <MenuItem dense disabled divider {...props} classes={{ root: className }} />
))(({ theme }) => ({
    color: theme.vars?.palette.text.primary,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(-0.5),
    opacity: '1 !important',
}));
