// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import Grid from '@mui/material/Grid';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import type { TicketService } from '@lib/tickets/TicketService';
import { FormGrid } from '@app/admin/components/FormGrid';
import { RefreshCacheAction } from './RefreshCacheAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

import { clearEventTicketTypesCache, updateTicketSettings } from '../TicketActions';

/**
 * Page displaying the settings for ticket management during this event. Information will be fetched
 * from the Ticket library, which abstracts over the supported ticket providers.
 */
export default async function EventTicketsSettingsPage(
    props: PageProps<'/admin/events/[event]/tickets/settings'>)
{
    const params = await props.params;
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    const service = await createTicketService(event.slug);
    if (!service)
        notFound();

    const refreshAction = clearEventTicketTypesCache.bind(null, event.slug);
    const updateAction = updateTicketSettings.bind(null, event.slug);

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
                <Suspense fallback={ <SectionLoading /> }>
                    <TicketSettings action={updateAction} service={service} />
                </Suspense>
            </Section>
        </>
    );
}

/**
 * Component that fetches ticket settings from the `service` and then displays a form grid through
 * which settings can be amended. Loading is deferred until the service responds.
 */
async function TicketSettings(props: { action: ServerAction, service: TicketService }) {
    const types = await props.service.listTicketTypes();
    return (
        <FormGrid action={props.action} spacing={2}>
            { types.map(type =>
                <Grid key={type.id} size={{ xs: 6, md: 4 }}>
                    <Typography variant="subtitle2" noWrap>
                        {type.name}
                    </Typography>
                    <Typography variant="body2" noWrap>
                        {type.id} — €{type.price}
                    </Typography>
                </Grid>
            )}
        </FormGrid>
    );
}

export const generateMetadata = createGenerateMetadataFn('Settings', 'Tickets', { event: 'event' });
