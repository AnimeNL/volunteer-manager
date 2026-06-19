// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import Paper from '@mui/material/Paper';

import { OutboxNavigation } from './OutboxNavigation';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Layout for the outbox page. Several tabs are shown displaying the outgoing messages over a set
 * of channels, including e-mail, WhatsApp and Web Push Notifications.
 */
export default function OutboxLayout(props: LayoutProps<'/admin/system/outbox'>) {
    return (
        <>
            <Section icon={ <OutboxOutlinedIcon color="primary" /> } title="Outbox"
                     breadcrumbs={[
                        { label: 'Communication', href: '/admin/system/communication' },
                        { label: 'Outbox' },
                     ]}>
                <SectionIntroduction>
                    Communication sent from the Volunteer Manager using one of various supported
                    channels. All messages can be inspected.
                </SectionIntroduction>
            </Section>
            <Paper>
                <OutboxNavigation />
                <Box sx={{ p: 2 }}>
                    {props.children}
                </Box>
            </Paper>
        </>
    );
}
