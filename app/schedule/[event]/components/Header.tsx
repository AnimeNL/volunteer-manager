// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import ListItemText from '@mui/material/ListItemText';
import ListItem from '@mui/material/ListItem';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';

import { kEnforceSingleLine } from '../Constants';

/**
 * Props accepted by the <Header> component.
 */
interface HeaderProps {
    /**
     * Primary title to display on the header.
     */
    title: string;

    /**
     * Secondary title to display on the header, if any.
     */
    subtitle?: string;

    /**
     * Icon, if any, to display as part of the header.
     */
    icon?: React.ReactNode;
}

/**
 * The <Header> component displays a header, in a style consistent with all other page headers part
 * of the scheduling app. The header is not actionable by default.
 */
export function Header(props: HeaderProps) {
    const { title, subtitle } = props;
    return (
        <Paper sx={{ maxWidth: '100vw' }}>
            <List>
                <ListItem>
                    <ListItemText primary={title} secondary={subtitle}
                                  slotProps={{ primary: { sx: kEnforceSingleLine } }} />
                </ListItem>
            </List>
        </Paper>
    );
}
