// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import ApiIcon from '@mui/icons-material/Api';
import CategoryIcon from '@mui/icons-material/Category';
import EventIcon from '@mui/icons-material/Event';
import Grid from '@mui/material/Grid';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import Typography from '@mui/material/Typography';

import { ActionBar } from '@app/admin/components/ActionBar';
import { ChangeImageQuickAction } from './ChangeImageQuickAction';
import { ChangeSlugQuickAction } from './ChangeSlugQuickAction';
import { EventSettingsForm } from './EventSettingsForm';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { PublishQuickAction } from './PublishQuickAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';
import db, { tEvents } from '@lib/database';

import { kEventAvailabilityStatus, type EventAvailabilityStatus } from '@lib/database/Types';

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
 * Page through which the primary configuration associated with a particular event can be adjusted.
 */
export default async function EventSettingsTeamsPage(
    props: PageProps<'/admin/events/[event]/settings/configuration'>)
{
    const { event } = await requireAuthenticationContextWithEvent(props, 'event.settings');

    const featuresFn = actions.updateEventFeatures.bind(null, event.slug);
    const identityFn = actions.updateEventIdentity.bind(null, event.slug);
    const integrationsFn = actions.updateEventIntegrations.bind(null, event.slug);

    const dbInstance = db;
    const defaultValues = await dbInstance.selectFrom(tEvents)
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
                yourTicketProviderId: tEvents.eventYtpId,
                weeztixEventGuid: tEvents.eventWeeztixGuid,
            },
        })
        .executeSelectOne();

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
                        {event.shortName} is live. Senior provileges have been granted and public
                        references to the event remain available.
                    </Alert> }
                <ActionBar>
                    <PublishQuickAction action={publishAction} published={event.published} />
                    <ChangeImageQuickAction action={changeImageAction} />
                    <ChangeSlugQuickAction action={changeSlugAction} />
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
                    <TextFieldElement name="yourTicketProviderId"
                                      label="YourTicketProvider Event ID"
                                      type="number" fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                     <TextFieldElement name="weeztixEventGuid" label="Weeztix Event GUID" fullWidth
                                       size="small" />
                </Grid>
            </FormGridSection>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Configuration', 'Settings', { event: 'event' });
