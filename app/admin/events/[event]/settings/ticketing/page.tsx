// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { SelectElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';

import { Cache } from '@lib/cache';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { RefreshButton } from './RefreshButton';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { WeeztixIcon } from '@app/admin/components/icons/WeeztixIcon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createWeeztixClient } from '@lib/integrations/weeztix';
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
 * Builds the options list for a `<SelectElement>`, always including a "None" entry and preserving
 * `currentValue` if it is no longer present in `options`.
 */
function buildSelectOptions(
    options: { id: string; label: string }[] | undefined,
    currentValue?: string | null)
{
    const result = [
        { id: '', label: 'None' },
        ...(options ?? []),
    ];

    if (!!currentValue && !result.some(option => option.id === currentValue))
        result.push({ id: currentValue, label: `Unknown (${currentValue})` });

    return result;
}

/**
 * Retrieves the cached Weeztix events, scanners and shops for the given `eventSlug`.
 */
async function getWeeztixOptions(eventSlug: string) {
    const cache = Cache.getInstance('TicketProvider');
    return cache.getOrInsert(`${eventSlug}/weeztix`, async () => {
        try {
            const client = await createWeeztixClient();
            const events = await client.listEvents();
            const scanners = await client.listScannerTypes();
            const shops = await client.listShops();

            return {
                events: events.map(event => ({ id: event.guid, label: event.name })),
                scanners: scanners.map(scanner => ({ id: scanner.guid, label: scanner.name })),
                shops: shops.map(shop => ({ id: shop.guid, label: shop.name })),
            };
        } catch (error: any) {
            console.error(error);
            return null;
        }
    });
}

/**
 * Page through which ticketing settings for a particular event can be configured.
 */
export default async function EventSettingsTicketingPage(
    props: PageProps<'/admin/events/[event]/settings/ticketing'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.settings');

    const refreshTicketingWeeztixFn = actions.refreshEventTicketingWeeztix.bind(null, event.slug);
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

    const weeztixOptions = settings.provider === kEventTicketProvider.Weeztix
        ? await getWeeztixOptions(event.slug)
        : null;

    const events = buildSelectOptions(weeztixOptions?.events, settings.eventWeeztixGuid);
    const scanners = buildSelectOptions(weeztixOptions?.scanners, settings.eventWeeztixScannerGuid);
    const shops = buildSelectOptions(weeztixOptions?.shops, settings.eventWeeztixShopGuid);

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
                                 headerAction={ <RefreshButton action={refreshTicketingWeeztixFn} /> }
                                 action={updateTicketingWeeztixFn}
                                 defaultValues={weeztixDefaultValues}>
                    <SectionIntroduction grid>
                        Integration details for {event.shortName} with{' '}
                        <MuiLink component={Link} href="https://weeztix.com/">Weeztix</MuiLink>.
                    </SectionIntroduction>
                    { !weeztixOptions &&
                        <Grid size={{ xs: 12 }}>
                            <Alert severity="warning" variant="outlined">
                                Unable to obtain available options from Weeztix.
                            </Alert>
                        </Grid> }
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="eventGuid" label="Event" fullWidth size="small"
                                       options={events} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="scannerGuid" label="Scanner" fullWidth size="small"
                                       options={scanners} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="shopGuid" label="Shop" fullWidth size="small"
                                       options={shops} />
                    </Grid>
                </FormGridSection> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Ticketing', 'Settings', { event: 'event' });
