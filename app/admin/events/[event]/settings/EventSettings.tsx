// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';

import { type EventAvailabilityStatus, kEventAvailabilityStatus } from '@lib/database/Types';
import { EventSettingsForm } from './EventSettingsForm';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeServerAction } from '@lib/serverAction';
import db, { tEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/api/Types';

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
] satisfies { id: number; label: string }[];;

/**
 * Options that can be presented regarding availability of the Volunteer Manager's services.
 */
const kServiceStatusOptions = [
    { id: 0, label: 'Disabled for this event' },
    { id: 1, label: 'Enabled for this event' },
] satisfies { id: number; label: string }[];

/**
 * The data associated with event settings. Used for both input and output validation.
 */
const kEventSettingsData = z.object({
    /**
     * Unique name of the event, including the theme. (E.g. AnimeCon 2025: Full Steam Ahead!)
     */
    name: z.string(),

    /**
     * Unique short name of the event. (E.g. AnimeCon 2025)
     */
    shortName: z.string(),

    /**
     * Unique slug of the event, represented in the URL.
     */
    slug: z.string(),

    /**
     * Time at which the event will commence, in the local timezone.
     */
    startTime: kTemporalZonedDateTime,

    /**
     * Time at which the event will finish, in the local timezone.
     */
    endTime: kTemporalZonedDateTime,

    /**
     * Whether event timing information has been published.
     */
    eventTimingPublished: z.coerce.number(),

    /**
     * Physical location at which the event will be taking place.
     */
    location: z.string(),

    /**
     * Timezone defining the local time at the convention relative to UTC.
     */
    timezone: z.string(),

    /**
     * AnPlan ID that has been assigned to this festival, for planning purposes.
     */
    festivalId: z.coerce.number().optional(),

    /**
     * URL to the hotel room form where submissions should be made.
     */
    hotelRoomForm: z.string().optional(),

    /**
     * YourTicketProvider event ID that has been assigned to this festival.
     */
    yourTicketProviderId: z.coerce.number().optional(),

    /**
     * Whether volunteers can indicate their availability.
     */
    availabilityStatus: z.enum(kEventAvailabilityStatus),

    /**
     * Whether hotel management is enabled for this event.
     */
    hotelEnabled: z.number(),

    /**
     * Wheter refund management is enabled for this event.
     */
    refundEnabled: z.number(),

    /**
     * Whether training management is enabled for this event.
     */
    trainingEnabled: z.number(),

    /**
     * Whether we solicit availability for build-up before the festival.
     */
    availabilityBuildUp: z.number(),

    /**
     * Whether we solicit availability for tear-down after the festival.
     */
    availabilityTearDown: z.number(),
});

/**
 * Server Action called when the team settings are being updated. Stores the information and writes
 * an appropriate log entry to track that the mutation happened.
 */
async function updateEventSettings(eventId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kEventSettingsData, async (data, props) => {
        await db.update(tEvents)
            .set({
                eventName: data.name,
                eventShortName: data.shortName,
                // Deliberate omission: `slug`, which has a dedicated update button in the header
                eventStartTime: data.startTime,
                eventEndTime: data.endTime,
                eventTimingPublished: data.eventTimingPublished,
                eventLocation: data.location,
                eventTimezone: data.timezone,
                eventFestivalId: data.festivalId,
                eventYtpId: data.yourTicketProviderId,
                eventHotelRoomForm: data.hotelRoomForm,

                eventAvailabilityStatus: data.availabilityStatus,
                hotelEnabled: data.hotelEnabled,
                refundEnabled: data.refundEnabled,
                trainingEnabled: data.trainingEnabled,
                availabilityBuildUp: data.availabilityBuildUp,
                availabilityTearDown: data.availabilityTearDown,
            })
            .where(tEvents.eventId.equals(eventId))
            .executeUpdate();

        RecordLog({
            type: kLogType.AdminUpdateEvent,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                action: 'event settings',
                event: data.shortName,
            }
        });

        // Refresh the router state, as toggling any of the management boxes may influence whether
        // certain menu options are available to the signed in user or not.
        return { success: true, refresh: true };
    });
}

/**
 * Props accepted by the <EventSettings> component.
 */
interface EventSettingsProps {
    /**
     * Unique ID of the event for which the settings are being displayed.
     */
    event: number;

    /**
     * Timezone defining the local time where the event will be taking place.
     */
    timezone?: string;
}

/**
 * The <EventSettings> component allows the administrator to change settings about the event itself,
 * such as its name, slug and dates over which it will take.
 */
export async function EventSettings(props: EventSettingsProps) {
    const action = updateEventSettings.bind(null, props.event);

    const dbInstance = db;
    const settings = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(props.event))
        .select({
            name: tEvents.eventName,
            shortName: tEvents.eventShortName,
            slug: tEvents.eventSlug,
            startTime: tEvents.eventStartTime,
            endTime: tEvents.eventEndTime,
            eventTimingPublished: tEvents.eventTimingPublished,
            location: tEvents.eventLocation,
            timezone: tEvents.eventTimezone,
            festivalId: tEvents.eventFestivalId,
            yourTicketProviderId: tEvents.eventYtpId,
            hotelRoomForm: tEvents.eventHotelRoomForm,

            availabilityStatus: tEvents.eventAvailabilityStatus,
            hotelEnabled: tEvents.hotelEnabled,
            refundEnabled: tEvents.refundEnabled,
            trainingEnabled: tEvents.trainingEnabled,
            availabilityBuildUp: tEvents.availabilityBuildUp,
            availabilityTearDown: tEvents.availabilityTearDown,
        })
        .executeSelectNoneOrOne() ?? undefined;

    return (
        <FormGridSection action={action} defaultValues={settings} title="Configuration">
            <EventSettingsForm />
            <Grid size={{ xs: 12 }}>
                <SelectElement name="eventTimingPublished" label="Publish event timing"
                               fullWidth size="small" options={kEventTimingPublishedOptions} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="location" label="Location"
                                  fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="timezone" label="Timezone"
                                  fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="festivalId" label="AnPlan Festival ID" type="number"
                                  fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <TextFieldElement name="yourTicketProviderId" label="YourTicketProvider Event ID"
                                  type="number" fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="hotelRoomForm" label="Hotel room form URL"
                                  fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="availabilityStatus" label="Availability status"
                               fullWidth size="small" options={kAvailabilityStatusOptions} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="hotelEnabled" label="Hotel management"
                               fullWidth size="small" options={kServiceStatusOptions} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="refundEnabled" label="Refund management"
                               fullWidth size="small" options={kServiceStatusOptions} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="trainingEnabled" label="Training management"
                               fullWidth size="small" options={kServiceStatusOptions} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="availabilityBuildUp" label="Solicit build-up availability"
                               fullWidth size="small" options={kServiceStatusOptions} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="availabilityTearDown" label="Solicit tear-down availability"
                               fullWidth size="small" options={kServiceStatusOptions} />
            </Grid>
        </FormGridSection>
    );
}
