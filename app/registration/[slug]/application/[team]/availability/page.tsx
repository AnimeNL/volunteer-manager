// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';
import { forbidden } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import EventNoteIcon from '@mui/icons-material/EventNote';

import type { NextPageParams } from '@lib/NextRouterParams';
import { AvailabilityExpectations } from './AvailabilityExpectations';
import { AvailabilityPreferencesForm } from './AvailabilityPreferencesForm';
import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { Markdown } from '@components/Markdown';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import { getPublicEventsForFestival, type EventTimeslotEntry } from './getPublicEventsForFestival';
import { getStaticContent } from '@lib/Content';
import db, { tEvents, tRoles, tUsersEvents } from '@lib/database';

import { kEventAvailabilityStatus } from '@lib/database/Types';

import * as actions from '../../ApplicationActions';

/**
 * The <EventApplicationAvailabilityPage> component enables our volunteers to indicate when they
 * will be around at the festival, and which events they really want to attend so that we can keep
 * these preferences in mind when making our schedules.
 */
export default async function EventApplicationAvailabilityPage(
    props: NextPageParams<'slug' | 'team'>)
{
    const { access, event, team, user } = await getApplicationContext(props);

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Decide whether the volunteer has the ability to provide and/or see their availability
    // preferences, or whether they have the necessary permission to access this regardless.
    // ---------------------------------------------------------------------------------------------

    let locked: boolean = false;
    if (!access.can('event.visible', { event: event.slug, team: team.slug })) {
        const availabilityStatus = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventId.equals(event.id))
            .selectOneColumn(tEvents.eventAvailabilityStatus)
            .executeSelectOne();

        locked = availabilityStatus === kEventAvailabilityStatus.Locked;

        if (availabilityStatus !== kEventAvailabilityStatus.Available && !locked)
            forbidden();
    }

    // ---------------------------------------------------------------------------------------------
    // Determine the form's settings and default values, i.e. what the user has indicated to be
    // their preferences thus far. Some of these fields need processing before being presented.
    // ---------------------------------------------------------------------------------------------

    const detailedApplicationInfo = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .where(tUsersEvents.userId.equals(user.id))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
        .select({
            event: {
                startTime: tEvents.eventStartTime,
                endTime: tEvents.eventEndTime,

                availabilityBuildUpEnabled: tEvents.availabilityBuildUp.equals(/* true= */ 1),
                availabilityTearDownEnabled: tEvents.availabilityTearDown.equals(/* true= */ 1),

                festivalId: tEvents.eventFestivalId,
                timezone: tEvents.eventTimezone,
            },
            preferences: {
                availabilityBuildUpTearDown: tUsersEvents.availabilityBuildUpTearDown,
                exceptions: tUsersEvents.availabilityExceptions,
                preferences: tUsersEvents.preferences,
                preferencesDietary: tUsersEvents.preferencesDietary,
                serviceHours: tUsersEvents.preferenceHours,
                serviceTiming: {
                    start: tUsersEvents.preferenceTimingStart,
                    end: tUsersEvents.preferenceTimingEnd,
                },
                timeslots: tUsersEvents.availabilityTimeslots,
            },
            settings: {
                exceptionEventLimit: tUsersEvents.availabilityEventLimit.valueWhenNull(
                    tRoles.roleAvailabilityEventLimit),
            },
        })
        .executeSelectOne();

    const defaultValues: Record<string, any> = {
        availabilityBuildUpTearDown:
            detailedApplicationInfo.preferences?.availabilityBuildUpTearDown,
        preferences: detailedApplicationInfo.preferences?.preferences,
        preferencesDietary: detailedApplicationInfo.preferences?.preferencesDietary,
        serviceHours: `${detailedApplicationInfo.preferences?.serviceHours}`,
    };

    if (!!detailedApplicationInfo.preferences?.serviceTiming) {
        const { start, end } = detailedApplicationInfo.preferences?.serviceTiming;
        defaultValues.serviceTiming = `${start}-${end}`;
    }

    if (!!detailedApplicationInfo.preferences?.timeslots) {
        defaultValues.exceptionEvents =
            detailedApplicationInfo.preferences.timeslots.split(',').map(v => parseInt(v));
    }

    // ---------------------------------------------------------------------------------------------
    // Determine the events that the volunteer is able to select as availability exceptions.
    // ---------------------------------------------------------------------------------------------

    let availabilityEvents: undefined | Array<EventTimeslotEntry>;
    let exceptionEvents: undefined | Array<{ id: number; label: string }>;

    if (!!detailedApplicationInfo.event.festivalId) {
        availabilityEvents = await getPublicEventsForFestival(
            detailedApplicationInfo.event.festivalId,
            detailedApplicationInfo.event.timezone,
            /* withTimingInfo= */ true);

        // Filter the |availabilityEvents| down to the information we want to send to the client.
        exceptionEvents = availabilityEvents.map(entry => ({ id: entry.id, label: entry.label }));
    }

    // ---------------------------------------------------------------------------------------------

    const action = actions.updateAvailability.bind(null, event.id, team.id);

    const content = await getStaticContent([ 'registration', 'application', 'availability' ], {
        firstName: user.nameOrFirstName,
    });

    return (
        <Box sx={{ p: 2 }}>
            { content && <Markdown>{content.markdown}</Markdown> }

            { !!availabilityEvents &&
                <AvailabilityExpectations
                    availabilityEvents={availabilityEvents}
                    eventStartTime={detailedApplicationInfo.event.startTime}
                    eventEndTime={detailedApplicationInfo.event.endTime}
                    eventTimezone={detailedApplicationInfo.event.timezone}
                    exceptionEvents={defaultValues.exceptionEvents}
                    exceptions={detailedApplicationInfo.preferences?.exceptions}
                    timing={detailedApplicationInfo.preferences?.serviceTiming} /> }

            <FormProvider action={action} defaultValues={defaultValues}>

                <AvailabilityPreferencesForm
                    eventStartDate={detailedApplicationInfo.event.startTime.toString()}
                    eventEndDate={detailedApplicationInfo.event.endTime.toString()}
                    exceptionEventLimit={detailedApplicationInfo.settings.exceptionEventLimit}
                    exceptionEvents={exceptionEvents}
                    includeBuildUp={detailedApplicationInfo.event.availabilityBuildUpEnabled}
                    includeTearDown={detailedApplicationInfo.event.availabilityTearDownEnabled}
                    readOnly={locked} />

                <FormSubmitButton callToAction="Save your preferences"
                                  startIcon={ <EventNoteIcon /> } sx={{ my: 2 }} />

            </FormProvider>

            <MuiLink component={Link} href={`/registration/${event.slug}/application`}>
                « Back to your registration
            </MuiLink>

        </Box>
    );
}

export const generateMetadata = generatePortalMetadataFn('Availability preferences');
