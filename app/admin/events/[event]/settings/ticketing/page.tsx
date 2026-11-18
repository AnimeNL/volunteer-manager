// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';

import { Cache } from '@lib/cache';
import { CmComIcon } from '@app/admin/components/icons/CmComIcon';
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
 * Options available for the user to select whether the automation should be enabled.
 */
const kEnableAutomationOptions = [
    { id: 0, label: 'Disabled' },
    { id: 1, label: 'Enabled' },
];

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
            const client = await createWeeztixClient(/* optionalMetadataFields= */ true);
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
 * Retrieves the cached Weeztix ticket types for the given `eventSlug` and `shopGuid`.
 */
async function getWeeztixTicketTypes(eventSlug: string, shopGuid: string) {
    const cache = Cache.getInstance('TicketProvider');
    return cache.getOrInsert(`${eventSlug}/weeztix/ticketTypes`, async () => {
        try {
            const client = await createWeeztixClient(/* optionalMetadataFields= */ true);
            const ticketTypes = await client.listShopTicketTypes(shopGuid);

            return {
                ticketTypes: ticketTypes.map(type => ({ id: type.guid, label: type.name })),
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
    const refreshTicketingWeeztixAutomationFn =
        actions.refreshEventTicketingWeeztixAutomation.bind(null, event.slug);
    const updateTicketingProviderFn = actions.updateEventTicketingProvider.bind(null, event.slug);
    const updateTicketingWeeztixFn = actions.updateEventTicketingWeeztix.bind(null, event.slug);
    const updateTicketingWeeztixAutomationFn =
        actions.updateEventTicketingWeeztixAutomation.bind(null, event.slug);
    const updateTicketingYtpFn = actions.updateEventTicketingYtp.bind(null, event.slug);
    const updateAutomationToggleFn =
        actions.updateEventTicketingAutomationToggle.bind(null, event.slug);

    const settings = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            provider: tEvents.ticketsProvider,
            ticketsAutoGrantEnabled: tEvents.ticketsAutoGrantEnabled,
            ticketsAutoRevokeEnabled: tEvents.ticketsAutoRevokeEnabled,
            eventWeeztixGuid: tEvents.eventWeeztixGuid,
            eventWeeztixScannerGuid: tEvents.eventWeeztixScannerGuid,
            eventWeeztixShopGuid: tEvents.eventWeeztixShopGuid,
            eventWeeztixGuestTicketGuid: tEvents.eventWeeztixGuestTicketGuid,
            eventWeeztixVendorTicketGuid: tEvents.eventWeeztixVendorTicketGuid,
            eventWeeztixVolunteerTicketGuid: tEvents.eventWeeztixVolunteerTicketGuid,
            eventYtpEventId: tEvents.eventYtpEventId,
            eventYtpExternalEventId: tEvents.eventYtpExternalEventId,
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

    const weeztixAutomationDefaultValues = {
        guestTicketGuid: settings.eventWeeztixGuestTicketGuid ?? '',
        vendorTicketGuid: settings.eventWeeztixVendorTicketGuid ?? '',
        volunteerTicketGuid: settings.eventWeeztixVolunteerTicketGuid ?? '',
    };

    const ytpDefaultValues = {
        ytpEventId: settings.eventYtpEventId,
        ytpExternalEventId: settings.eventYtpExternalEventId ?? '',
    };

    const showWeeztix = settings.provider === kEventTicketProvider.Weeztix;
    const showWeeztixAutomation =
        showWeeztix && !!settings.eventWeeztixGuid && !!settings.eventWeeztixShopGuid;
    const showYtp = settings.provider === kEventTicketProvider.YourTicketProvider;

    const weeztixOptions = showWeeztix ? await getWeeztixOptions(event.slug) : null;
    const weeztixTicketTypes = showWeeztixAutomation
        ? await getWeeztixTicketTypes(event.slug, settings.eventWeeztixShopGuid!)
        : null;

    const events = buildSelectOptions(weeztixOptions?.events, settings.eventWeeztixGuid);
    const scanners = buildSelectOptions(weeztixOptions?.scanners, settings.eventWeeztixScannerGuid);
    const shops = buildSelectOptions(weeztixOptions?.shops, settings.eventWeeztixShopGuid);

    const guestTickets =
        buildSelectOptions(weeztixTicketTypes?.ticketTypes, settings.eventWeeztixGuestTicketGuid);
    const vendorTickets =
        buildSelectOptions(weeztixTicketTypes?.ticketTypes, settings.eventWeeztixVendorTicketGuid);
    const volunteerTickets = buildSelectOptions(
        weeztixTicketTypes?.ticketTypes, settings.eventWeeztixVolunteerTicketGuid);

    return (
        <>
            <Section icon={ <LocalActivityIcon color="primary" /> } title="Ticketing"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                         { label: 'Ticketing' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding {event.shortName}'s integration with our ticketing partners.
                </SectionIntroduction>
            </Section>
            <FormGridSection noHeader tabs action={updateTicketingProviderFn}
                             defaultValues={defaultValues}>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="provider" label="Ticketing partner"
                                   options={kTicketingProviderOptions} fullWidth size="small" />
                </Grid>
            </FormGridSection>
            { showWeeztix &&
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
            { showWeeztixAutomation &&
                <FormGridSection icon={ <WeeztixIcon /> } title="Weeztix automation"
                                 headerAction={
                                     <RefreshButton action={refreshTicketingWeeztixAutomationFn} />
                                 }
                                 action={updateTicketingWeeztixAutomationFn}
                                 defaultValues={weeztixAutomationDefaultValues}>
                    <SectionIntroduction grid>
                        Ticket selection for automation features available in the Volunteer Manager.
                    </SectionIntroduction>
                    { !weeztixTicketTypes &&
                        <Grid size={{ xs: 12 }}>
                            <Alert severity="warning" variant="outlined">
                                Unable to obtain available ticket types from Weeztix.
                            </Alert>
                        </Grid> }
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="guestTicketGuid" label="Guest ticket" fullWidth
                                       size="small" options={guestTickets} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="vendorTicketGuid" label="Vendor ticket" fullWidth
                                       size="small" options={vendorTickets} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="volunteerTicketGuid" label="Volunteer ticket" fullWidth
                                       size="small" options={volunteerTickets} />
                    </Grid>
                </FormGridSection> }
            { (showWeeztixAutomation && !!settings.eventWeeztixVolunteerTicketGuid) &&
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 6 }}>
                        <FormGridSection icon={ <LocalActivityIcon color="primary" /> }
                                         title="Automatically grant tickets"
                                         action={updateAutomationToggleFn.bind(null, 'autoGrant')}
                                         defaultValues={{
                                             enabled: settings.ticketsAutoGrantEnabled,
                                         }}>
                            <SectionIntroduction grid>
                                Automatically grant volunteer tickets when volunteers are approved.
                            </SectionIntroduction>
                            <Grid size={{ xs: 12 }}>
                                <SelectElement name="enabled" label="Status" required fullWidth
                                               size="small" options={kEnableAutomationOptions} />
                            </Grid>
                        </FormGridSection>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 6 }}>
                        <FormGridSection icon={ <LocalActivityIcon color="primary" /> }
                                         title="Automatically revoke tickets"
                                         action={updateAutomationToggleFn.bind(null, 'autoRevoke')}
                                         defaultValues={{
                                             enabled: settings.ticketsAutoRevokeEnabled,
                                         }}>
                            <SectionIntroduction grid>
                                Automatically revoke volunteer tickets when volunteers cancel.
                            </SectionIntroduction>
                            <Grid size={{ xs: 12 }}>
                                <SelectElement name="enabled" label="Status" required fullWidth
                                               size="small" options={kEnableAutomationOptions} />
                            </Grid>
                        </FormGridSection>
                    </Grid>
                </Grid> }
            { showYtp &&
                <FormGridSection icon={ <CmComIcon /> } title="YourTicketProvider"
                                 action={updateTicketingYtpFn}
                                 defaultValues={ytpDefaultValues}>
                    <SectionIntroduction grid>
                        Integration details for {event.shortName} with{' '}
                        <MuiLink component={Link} href="https://www.yourticketprovider.nl/">
                            YourTicketProvider
                        </MuiLink>.
                    </SectionIntroduction>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="ytpEventId" label="Event ID" type="number"
                                          fullWidth size="small" />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="ytpExternalEventId" label="External Event ID"
                                          fullWidth size="small" />
                    </Grid>
                </FormGridSection> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Ticketing', 'Settings', { event: 'event' });
