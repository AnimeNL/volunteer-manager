// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

import { OutboxNavigation } from './OutboxNavigation';

/**
 * Layout for the outbox page. Several tabs are shown displaying the outgoing messages over a set
 * of channels, including e-mail, WhatsApp and Web Push Notifications.
 */
export default function OutboxLayout(props: LayoutProps<'/admin/system/outbox'>) {
    return (
        <Paper>
            <OutboxNavigation />
            <Box sx={{ p: 2 }}>
                {props.children}
            </Box>
        </Paper>
    );
}
