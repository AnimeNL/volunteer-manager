// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import ApiIcon from '@mui/icons-material/Api';
import CategoryIcon from '@mui/icons-material/Category';
import EventIcon from '@mui/icons-material/Event';
import Grid from '@mui/material/Grid';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import Typography from '@mui/material/Typography';

import type { EventAvailabilityStatus } from '@lib/database/Types';
import type { TicketService } from '@lib/tickets/TicketService';
import { ActionBar } from '@app/admin/components/ActionBar';
import { AnonymizeRefundsButton } from './AnonymizeRefundsButton';
import { AnonymizeTicketsButton } from './AnonymizeTicketsButton';
import { ChangeImageQuickAction } from './ChangeImageQuickAction';
import { ChangeSlugQuickAction } from './ChangeSlugQuickAction';
import { EventSettingsForm } from './EventSettingsForm';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { GridCollapse } from '@components/GridCollapse';
import { PublishQuickAction } from './PublishQuickAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tStorage } from '@lib/database';

import { kEventAvailabilityStatus, kEventTicketProvider } from '@lib/database/Types';

import * as actions from '../SettingsActions';

/**
 * Options that can be presented to the senior in regards to the event availability status.
 */
const kAvailabilityStatusOptions = [
    {
        id: kEventAvailabilityStatus.Unavailable,
        label: 'Volunteers cannot indicate their availability'
    },
    {
        id: kEventAvailabilityStatus.Available,
        label: 'Volunteers can indicate their availability'
    },
    {
        id: kEventAvailabilityStatus.Locked,
        label: 'Volunteers can see their availability, but not change it'
    },
] satisfies { id: EventAvailabilityStatus; label: string }[];

/**
 * Options available for the user to select whether the automation should be enabled.
 */
const kEnableAutomationOptions = [
    { id: 0, label: 'Disabled' },
    { id: 1, label: 'Enabled' },
];

/**
 * Options that can be presented regarding publishing event timing information.
 */
const kEventTimingPublishedOptions = [
    { id: 0, label: 'Date announcement is still pending…' },
    { id: 1, label: 'Event dates have been announced' },

] satisfies { id: number; label: string }[];

/**
 * Options that can be presented regarding availability of the Volunteer Manager's services.
 */
const kServiceStatusOptions = [
    { id: 0, label: 'Disabled for this event' },
    { id: 1, label: 'Enabled for this event' },

] satisfies { id: number; label: string }[];

/**
 * Ticket provider options that are integrated with the portal.
 */
const kTicketingProviderOptions = [
    { id: '', label: 'None' },
    ...Object.values(kEventTicketProvider).map(provider => ({ id: provider, label: provider })),
];

/**
 * Page through which the primary configuration associated with a particular event can be adjusted.
 */
export default async function EventSettingsConfigurationPage(
    props: PageProps<'/admin/events/[event]/settings/configuration'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props, 'event.settings');

    const featuresFn = actions.updateEventFeatures.bind(null, event.slug);
    const identityFn = actions.updateEventIdentity.bind(null, event.slug);
    const integrationsFn = actions.updateEventIntegrations.bind(null, event.slug);
    const ticketingFn = actions.updateEventTicketing.bind(null, event.slug);

    const storageJoin = tStorage.forUseInLeftJoin();

    const dbInstance = db;
    const defaultValues = await dbInstance.selectFrom(tEvents)
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tEvents.eventIdentityId))
        .where(tEvents.eventId.equals(event.id))
        .select({
            event: {
                endTime: dbInstance.dateTimeAsString(tEvents.eventEndTime),
                eventTimingPublished: tEvents.eventTimingPublished,
                location: tEvents.eventLocation,
                name: tEvents.eventName,
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,
                startTime: dbInstance.dateTimeAsString(tEvents.eventStartTime),
                timezone: tEvents.eventTimezone,
            },
            features: {
                availabilityStatus: tEvents.eventAvailabilityStatus,
                hotelEnabled: tEvents.hotelEnabled,
                refundEnabled: tEvents.refundEnabled,
                trainingEnabled: tEvents.trainingEnabled,
                availabilityBuildUp: tEvents.availabilityBuildUp,
                availabilityTearDown: tEvents.availabilityTearDown,
            },
            integrations: {
                festivalId: tEvents.eventFestivalId,
                hotelRoomForm: tEvents.eventHotelRoomForm,
                yourTicketProviderEventId: tEvents.eventYtpEventId,
                yourTicketProviderExternalEventId: tEvents.eventYtpExternalEventId,
                weeztixEventGuid: tEvents.eventWeeztixGuid,
            },
            tickets: {
                provider: tEvents.ticketsProvider,
                autoGrant: tEvents.ticketsAutoGrantEnabled,
                autoRevoke: tEvents.ticketsAutoRevokeEnabled,
                volunteerTicketId: tEvents.ticketsAutoGrantTicketId,
            },
            identityHash: storageJoin.fileHash,
        })
        .executeSelectOne();

    const service = await createTicketService(event.slug);

    const anonymizeRefundsFn = access.can('root')
        ? actions.anonymizeRefundRequests.bind(null, event.slug)
        : undefined!;

    const anonymizeTicketsFn = access.can('root')
        ? actions.anonymizeVisitorTickets.bind(null, event.slug)
        : undefined!;

    const changeImageAction = actions.changeEventImage.bind(null, event.slug);
    const changeSlugAction = actions.changeEventSlug.bind(null, event.slug);
    const publishAction = actions.publishEvent.bind(null, event.slug);

    return (
        <>
            <Section icon={ <SettingsSuggestIcon color="primary" /> } title="Configuration"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                        { label: 'Configuration' },
                     ]}>
                <SectionIntroduction>
                    Configuration regarding {event.shortName}'s dates, facilities and identity.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                { !event.published &&
                    <Alert variant="outlined" severity="warning">
                        {event.shortName} has been suspended. Senior privileges have been revoked
                        and public references have been removed.
                    </Alert> }
                { !!event.published &&
                    <Alert variant="outlined" severity="success">
                        {event.shortName} is live. Senior privileges have been granted and public
                        references to the event remain available.
                    </Alert> }
                <ActionBar>
                    <PublishQuickAction action={publishAction} published={event.published} />
                    <ChangeImageQuickAction action={changeImageAction}
                                            imageHash={defaultValues.identityHash} />
                    <ChangeSlugQuickAction action={changeSlugAction} slug={event.slug} />
                </ActionBar>
            </Section>
            <FormGridSection icon={ <EventIcon /> } title="Event" action={identityFn}
                             defaultValues={defaultValues.event}>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        Basic information about the name and timing of the event.
                    </Typography>
                </Grid>
                <EventSettingsForm />
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="eventTimingPublished" label="Publish event timing"
                                   fullWidth size="small" options={kEventTimingPublishedOptions} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="location" label="Location" fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="timezone" label="Timezone" fullWidth size="small" />
                </Grid>
            </FormGridSection>
            <FormGridSection icon={ <CategoryIcon /> } title="Features" action={featuresFn}
                             defaultValues={defaultValues.features}>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        Functionality that the Volunteer Manager should make available for this
                        event.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="availabilityStatus" label="Availability status"
                                   fullWidth size="small" options={kAvailabilityStatusOptions} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="hotelEnabled" label="Hotel management"
                                   fullWidth size="small" options={kServiceStatusOptions} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="refundEnabled" label="Refund management"
                                   fullWidth size="small" options={kServiceStatusOptions} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="trainingEnabled" label="Training management"
                                   fullWidth size="small" options={kServiceStatusOptions} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="availabilityBuildUp" label="Solicit build-up availability"
                                   fullWidth size="small" options={kServiceStatusOptions} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="availabilityTearDown"
                                   label="Solicit tear-down availability"
                                   fullWidth size="small" options={kServiceStatusOptions} />
                </Grid>
            </FormGridSection>
            <FormGridSection icon={ <ApiIcon />} title="Integrations" action={integrationsFn}
                             defaultValues={defaultValues.integrations}>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        Integrations with third party services to power functionality for the event.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="festivalId" label="AnPlan Festival ID" type="number"
                                     fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="hotelRoomForm" label="Hotel room form URL"
                                      fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="yourTicketProviderEventId"
                                      label="YourTicketProvider Event ID"
                                      type="number" fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="yourTicketProviderExternalEventId"
                                      label="YourTicketProvider External Event ID"
                                      fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12 }}>
                     <TextFieldElement name="weeztixEventGuid" label="Weeztix Event GUID" fullWidth
                                       size="small" />
                </Grid>
            </FormGridSection>
            { (!!defaultValues.integrations?.yourTicketProviderEventId ||
                   !!defaultValues.integrations?.weeztixEventGuid) &&
                <FormGridSection icon={ <LocalActivityOutlinedIcon />} title="Ticketing"
                                 action={ticketingFn} defaultValues={defaultValues.tickets}>
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="body2">
                            Automation available based on integration with our ticketing partners.
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <SelectElement name="provider" label="Ticketing partner"
                                       options={kTicketingProviderOptions} fullWidth size="small" />
                    </Grid>
                    <GridCollapse in={!!service} size={{ xs: 12 }}>
                        <Suspense fallback={ <SectionLoading /> }>
                            { !!service && <TicketSettings service={service} /> }
                        </Suspense>
                    </GridCollapse>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SelectElement name="autoGrant" label="Automatically grant tickets"
                                       required options={kEnableAutomationOptions} fullWidth
                                       size="small" disabled={!service} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SelectElement name="autoRevoke" label="Automatically revoke tickets"
                                       required options={kEnableAutomationOptions} fullWidth
                                       size="small" disabled={!service} />
                    </Grid>
                </FormGridSection> }
            { (!!anonymizeRefundsFn || !!anonymizeTicketsFn) &&
                <Section icon={ <ReportOutlinedIcon color="error" /> } title="Danger zone">
                    <SectionIntroduction>
                        These actions may permanently affect this event. Use with caution.
                    </SectionIntroduction>
                    { anonymizeRefundsFn && <AnonymizeRefundsButton action={anonymizeRefundsFn} /> }
                    { anonymizeTicketsFn && <AnonymizeTicketsButton action={anonymizeTicketsFn} /> }
                </Section> }
        </>
    );
}

/**
 * Component that fetches ticket settings from the `service` and then displays a form grid through
 * which settings can be amended. Loading is deferred until the service responds.
 */
async function TicketSettings(props: { service: TicketService }) {
    const types = await props.service.listTicketTypes();
    if (!types.length) {
        return (
            <Alert severity="warning" variant="outlined">
                Unable to obtain available ticket types from the ticketing partner.
            </Alert>
        );
    }

    const typeOptions = [
        { id: '', label: 'None' },
        ...types.map(type => ({ id: `${type.id}`, label: type.name })),
    ];

    return (
        <SelectElement name="volunteerTicketId" label="Volunteer ticket type"
                       options={typeOptions} fullWidth size="small" />
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Configuration', 'Settings', { event: 'event' });
