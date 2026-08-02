// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import { SelectElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import type { TicketService } from '@lib/tickets/TicketService';
import { FormGrid } from '@app/admin/components/FormGrid';
import { RefreshCacheAction } from './RefreshCacheAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

import { kEventTicketProvider } from '@lib/database/Types';

import { clearEventTicketTypesCache, updateTicketSettings } from '../TicketActions';

/**
 * Options available for the user to select whether the automation should be enabled.
 */
const kEnableAutomationOptions = [
    { id: 0, label: 'Disabled' },
    { id: 1, label: 'Enabled' },
];

/**
 * Ticket provider options that are integrated with the portal.
 */
const kProviderOptions = [
    { id: '', label: 'None' },
    ...Object.values(kEventTicketProvider).map(provider => ({ id: provider, label: provider })),
];

/**
 * Page displaying the settings for ticket management during this event. Information will be fetched
 * from the Ticket library, which abstracts over the supported ticket providers.
 */
export default async function EventTicketsSettingsPage(
    props: PageProps<'/admin/events/[event]/tickets/settings'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const service = await createTicketService(event.slug);

    const defaultValues = {
        provider: event.tickets?.provider,
        autoGrant: event.tickets?.enableAutoGrant ? 1 : 0,
        autoRevoke: event.tickets?.enableAutoRevoke ? 1 : 0,
        volunteerTicketId: event.tickets?.volunteerTicketId,
    };

    const refreshAction = clearEventTicketTypesCache.bind(null, event.slug);
    const updateAction = updateTicketSettings.bind(null, event.slug);

    const readOnly = !access.can('event.settings', { event: event.slug });

    return (
        <>
            <Section icon={ <SettingsOutlinedIcon color="primary" /> } title="Ticket settings"
                     headerAction={ <RefreshCacheAction action={refreshAction} /> }
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding ticket management for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <FormGrid action={updateAction} defaultValues={defaultValues} spacing={2}>
                     <Grid size={{ xs: 12 }}>
                        <SelectElement name="provider" label="Ticketing partner"
                                       options={kProviderOptions} fullWidth size="small"
                                       slotProps={{ select: { disabled: readOnly } }} />
                     </Grid>
                { !!service &&
                    <Suspense fallback={ <SectionLoading /> }>
                        <TicketSettings readOnly={readOnly} service={service} />
                    </Suspense> }
                </FormGrid>
            </Section>
        </>
    );
}

/**
 * Component that fetches ticket settings from the `service` and then displays a form grid through
 * which settings can be amended. Loading is deferred until the service responds.
 */
async function TicketSettings(props: { readOnly: boolean; service: TicketService }) {
    const types = await props.service.listTicketTypes();
    const typeOptions = [
        { id: '', label: 'None' },
        ...types.map(type => ({ id: `${type.id}`, label: type.name })),
    ];

    return (
        <>
            <Grid size={{ xs: 12 }}>
                { !types.length &&
                    <Alert severity="warning" variant="outlined">
                        Unable to obtain available ticket types from the ticketing partner.
                    </Alert> }
                { !!types.length &&
                    <SelectElement name="volunteerTicketId" label="Volunteer ticket type"
                                   options={typeOptions} fullWidth size="small"
                                   slotProps={{ select: { disabled: props.readOnly } }} /> }
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="autoGrant" label="Automatically grant tickets" required
                               options={kEnableAutomationOptions} fullWidth size="small"
                               disabled={!types.length}
                               slotProps={{ select: { disabled: props.readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="autoRevoke" label="Automatically revoke tickets" required
                               options={kEnableAutomationOptions} fullWidth size="small"
                               disabled={!types.length}
                               slotProps={{ select: { disabled: props.readOnly } }} />
            </Grid>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Settings', 'Tickets', { event: 'event' });
