// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

/**
 * Props accepted by the <AdminHeaderEventsMenu> component.
 */
interface AdminHeaderEventsMenuProps {
    /**
     * The events that should be shown as part of this menu option, if any.
     */
    events: {
        /**
         * Short name that we can use to refer to the event.
         */
        shortName: string;

        /**
         * URL-safe slug representing the event.
         */
        slug: string;

        /**
         * Whether the event has finished already. This will be visually reflected.
         */
        finished: boolean;

    }[];
}

/**
 * The <AdminHeaderEventsMenu> component represents the client-side logic required to render the
 * Events menu option, which expands to a list of the available options.
 */
export function AdminHeaderEventsMenu(props: AdminHeaderEventsMenuProps) {
    const [ anchorElement, setAnchorElement ] = useState<HTMLElement | null>(/* closed= */ null);

    const handleMenuClose = useCallback(() => setAnchorElement(null), [ /* no dependencies */ ]);
    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorElement(event.currentTarget);
    }, [ /* no dependencies */ ]);

    if (!props.events.length)
        return <></>;

    return (
        <>
            <Button endIcon={ <ExpandMoreIcon /> } variant="text" color="inherit"
                    onClick={handleMenuOpen}>
                Events
            </Button>

            <Menu anchorEl={anchorElement} variant="menu"
                  open={!!anchorElement}
                  onClose={handleMenuClose}>

                { props.events.map((event, index) =>
                    <MenuItem key={index} component={Link} href={`/admin/events/${event.slug}`}
                              onClick={handleMenuClose}>
                        <ListItemIcon>
                            { !!event.finished &&
                                <TaskAltIcon color="disabled" fontSize="small" /> }
                            { !event.finished &&
                                <PlayCircleOutlineIcon color="success" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText primary={event.shortName} />
                    </MenuItem> )}

                <Divider />

                <MenuItem component={Link} href="/admin/events" onClick={handleMenuClose}>
                    <ListItemIcon>
                        <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Manage events" />
                </MenuItem>

            </Menu>
        </>
    );
}
