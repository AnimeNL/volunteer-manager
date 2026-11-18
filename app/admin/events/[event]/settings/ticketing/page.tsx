// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { WeeztixIcon } from '@app/admin/components/icons/WeeztixIcon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents } from '@lib/database';

import { kEventTicketProvider } from '@lib/database/Types';

import * as actions from '../SettingsActions';

/**
 * Ticket provider options that are integrated with the portal.
 */
const kTicketingProviderOptions = [
    { id: '', label: 'None' },
    ...Object.values(kEventTicketProvider).map(provider => ({ id: provider, label: provider })),
];

/**
 * Page through which ticketing settings for a particular event can be configured.
 */
export default async function EventSettingsTicketingPage(
    props: PageProps<'/admin/events/[event]/settings/ticketing'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.settings');

    const updateTicketingProviderFn = actions.updateEventTicketingProvider.bind(null, event.slug);
    const updateTicketingWeeztixFn = actions.updateEventTicketingWeeztix.bind(null, event.slug);

    const settings = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            provider: tEvents.ticketsProvider,
            eventWeeztixGuid: tEvents.eventWeeztixGuid,
            eventWeeztixScannerGuid: tEvents.eventWeeztixScannerGuid,
            eventWeeztixShopGuid: tEvents.eventWeeztixShopGuid,
        })
        .executeSelectOne();

    const defaultValues = {
        provider: settings.provider ?? '',
    };

    const weeztixDefaultValues = {
        eventGuid: settings.eventWeeztixGuid ?? '',
        scannerGuid: settings.eventWeeztixScannerGuid ?? '',
        shopGuid: settings.eventWeeztixShopGuid ?? '',
    };

    return (
        <>
            <Section icon={ <LocalActivityIcon color="primary" /> } title="Ticketing"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                         { label: 'Ticketing' },
                     ]}>
                <SectionIntroduction>
                    Ticketing configuration for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <FormGridSection noHeader tabs action={updateTicketingProviderFn}
                             defaultValues={defaultValues}>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="provider" label="Ticketing partner"
                                   options={kTicketingProviderOptions} fullWidth size="small" />
                </Grid>
            </FormGridSection>
            { settings.provider === kEventTicketProvider.Weeztix &&
                <FormGridSection icon={ <WeeztixIcon /> } title="Weeztix"
                                 action={updateTicketingWeeztixFn}
                                 defaultValues={weeztixDefaultValues}>
                    <SectionIntroduction grid>
                        Integration details for {event.shortName} with{' '}
                        <MuiLink component={Link} href="https://weeztix.com/">Weeztix</MuiLink>.
                    </SectionIntroduction>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="eventGuid" label="Event" fullWidth size="small" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="scannerGuid" label="Scanner" fullWidth
                                          size="small" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="shopGuid" label="Shop" fullWidth size="small" />
                    </Grid>
                </FormGridSection> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Ticketing', 'Settings', { event: 'event' });
