// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Alert from '@mui/material/Alert';
import EventNoteIcon from '@mui/icons-material/EventNote';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { WeeztixIcon } from '@app/admin/components/icons/WeeztixIcon';
import { createWeeztixClient, type WeeztixClient } from '@lib/integrations/weeztix';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Page that demonstrates some of Weeztix' APIs, primarily to test the implementation and provide
 * quick insight in values (such as event GUIDs) that may be repeatedly needed.
 */
export default async function WeeztixIntegrationPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    const client = await createWeeztixClient();

    // TODO: Figure out how to issue API calls sequentially.

    return (
        <>
            <Section icon={ <WeeztixIcon /> } title="Weeztix"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'Weeztix' },
                     ]}>
                <SectionIntroduction>
                    Weeztix is AnimeCon's ticketing partner, which we integrate with for purposes of
                    providing statistics, scanning capabilities, and ticket automations.
                </SectionIntroduction>
            </Section>
            <Section icon={ <EventNoteIcon />} title="Events">
                <Suspense fallback={ <SectionLoading /> }>
                    <WeeztixEventList clientFn={ async () => client } />
                </Suspense>
            </Section>
        </>
    );
}

/**
 * Displays the event list using the Weeztix API.
 */
async function WeeztixEventList(props: { clientFn: () => Promise<WeeztixClient> }) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const client = await props.clientFn();
    const events = await client.listEvents();

    return (
        <>
            { !events.length &&
                <Alert severity="warning" variant="outlined">
                    No events could be obtained from Weeztix
                </Alert> }
            { !!events.length &&
                <List dense disablePadding>
                    { events.map((event, index) =>
                        <ListItem key={event.guid} disableGutters
                                  divider={ index !== events.length - 1 }>
                            <ListItemIcon>
                                <LocalActivityOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={event.name}
                                secondary={`${event.location.name} / GUID: ${event.guid}`} />
                        </ListItem> ) }
                </List> }
        </>
    );
}
