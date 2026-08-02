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
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import Typography from '@mui/material/Typography';

import { CmComIcon } from '@app/admin/components/icons/CmComIcon';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { createYourTicketProviderClient, type YourTicketProviderClient }
    from '@lib/integrations/yourticketprovider';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Page that demonstrates some of YourTicketProvider' APIs, primarily to test the implementation and
 * provide quick insight in values (such as event IDs) that may be repeatedly needed.
 */
export default async function YourTicketProviderIntegrationPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    const client = await createYourTicketProviderClient();

    const { promise: organiserPromise, resolve: organiserResolver } =
        Promise.withResolvers<number | undefined>();

    return (
        <>
            <Section icon={ <CmComIcon /> } title="YourTicketProvider"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'YourTicketProvider' },
                     ]}>
                <SectionIntroduction>
                    YourTicketProvider is one of AnimeCon's ticketing partners, which we integrate
                    with for purposes of providing statistics and automations.
                </SectionIntroduction>
            </Section>
            <Section icon={ <PeopleIcon />} title="Organisers">
                <Suspense fallback={ <SectionLoading /> }>
                    <YourTicketProviderOrganisersList
                        client={client}
                        resolver={organiserResolver} />
                </Suspense>
            </Section>
            <Section icon={ <EventNoteIcon />} title="Events">
                <Suspense fallback={ <SectionLoading /> }>
                    <YourTicketProviderEventList
                        client={client}
                        organiserPromise={organiserPromise} />
                </Suspense>
            </Section>
        </>
    );
}

/**
 * Displays the organiser list using the YourTicketProvider API.
 */
async function YourTicketProviderOrganisersList(
    props: { client: YourTicketProviderClient, resolver: (organiserId?: number) => void })
{
    const organisers = await props.client.listOrganisers();

    props.resolver(organisers[0]?.Id);

    if (!organisers.length) {
        return (
            <Alert severity="warning" variant="outlined">
                No organisers could be obtained from YourTicketProvider.
            </Alert>
        );
    }

    return (
        <List dense disablePadding>
            { organisers.map((organiser, index) =>
                <ListItem key={organiser.Id} disableGutters
                            divider={ index !== organisers.length - 1 }>
                    <ListItemIcon>
                        <PersonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={`${organiser.FirstName} ${organiser.LastName}`}
                        secondary={`${organiser.Email} / ID: ${organiser.Id}`} />
                </ListItem> ) }
        </List>
    );
}

/**
 * Displays the event list using the YourTicketProvider API.
 */
async function YourTicketProviderEventList(
    props: { client: YourTicketProviderClient, organiserPromise: Promise<number | undefined> })
{
    const organiserId = await props.organiserPromise;
    if (!organiserId) {
        return (
            <Alert severity="warning" variant="outlined">
                Unable to fetch event information without access to organisers.
            </Alert>
        );
    }

    const events = await props.client.listEvents(organiserId);
    if (!events.length) {
        return (
            <Alert severity="warning" variant="outlined">
                No events could be obtained from YourTicketProvider.
            </Alert>
        );
    }

    return (
        <List dense disablePadding>
            { events.filter(v => !!v.Name).map((event, index) =>
                <ListItem key={event.Id} disableGutters
                            divider={ index !== events.length - 1 }>
                    <ListItemIcon>
                        <LocalActivityOutlinedIcon
                            fontSize="small"
                            color={ event.Live ? 'success' : 'error' } />
                    </ListItemIcon>
                    <ListItemText
                        primary={event.Name}
                        secondary={`${event.LocationName || 'No location'} / ID: ${event.Id}`} />
                    <Typography variant="body2" color="textDisabled" noWrap sx={{ ml: 2 }}>
                        <LocalDateTime dateTime={`${event.StartDateTime}[UTC]`} format="MMM D–" />
                        <LocalDateTime dateTime={`${event.EndDateTime}[UTC]`} format="D, YYYY" />
                    </Typography>
                </ListItem> ) }
        </List>
    );
}
