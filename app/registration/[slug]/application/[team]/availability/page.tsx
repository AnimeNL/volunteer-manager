// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import EventNoteIcon from '@mui/icons-material/EventNote';
import Grid from '@mui/material/Grid';

import { AvailabilityExpectations } from './AvailabilityExpectations';
import { AvailabilityForm } from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/AvailabilityForm';
import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import { getAvailabilityTimeslots }
    from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/getAvailabilityTimeslots';
import { getStaticContent } from '@lib/Content';
import db, { tEvents, tRoles, tUsersEvents, tUsersEventsPreferencesAvailability } from '@lib/database';

import { kEventAvailabilityStatus } from '@lib/database/Types';

import { updateAvailabilityPreferences }
    from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/PreferenceActions';


/**
 * The <EventApplicationAvailabilityPage> component enables our volunteers to indicate when they
 * will be around at the festival, and which events they really want to attend so that we can keep
 * these preferences in mind when making our schedules.
 */
export default async function EventApplicationAvailabilityPage(
    props: PageProps<'/registration/[slug]/application/[team]/availability'>)
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

    const preferencesAvailabilityJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

    const combinedTimingFragment = dbInstance.fragmentWithType('string', 'required').sql`
        CONCAT_WS('-', ${preferencesAvailabilityJoin.availabilityTimingStart},
                       ${preferencesAvailabilityJoin.availabilityTimingEnd})`;

    const detailedApplicationInfo = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(preferencesAvailabilityJoin)
            .on(preferencesAvailabilityJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesAvailabilityJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesAvailabilityJoin.teamId.equals(tUsersEvents.teamId))
                .and(preferencesAvailabilityJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
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
                buildUpTearDown: preferencesAvailabilityJoin.availabilityBuildUpTearDown,
                exceptions: preferencesAvailabilityJoin.availabilityExceptions.valueWhenNull('[]'),
                hours: preferencesAvailabilityJoin.availabilityHours,
                timeslotsStr: preferencesAvailabilityJoin.availabilityTimeslots,
                timing: combinedTimingFragment,
                remarks: preferencesAvailabilityJoin.availabilityRemarks,
            },
            settings: {
                exceptionEventLimit: tUsersEvents.availabilityEventLimit.valueWhenNull(
                    tRoles.roleAvailabilityEventLimit),
            },
        })
        .executeSelectOne();

    const action = updateAvailabilityPreferences.bind(null, user.id, event.slug, team.slug);

    const content = await getStaticContent([ 'registration', 'application', 'availability' ], {
        substitutions: {
            firstName: user.nameOrFirstName,
        },
    });

    const timeslots = await getAvailabilityTimeslots(event.id, true);
    const filteredTimeslots = timeslots.map(timeslot => ({
        id: timeslot.id,
        label: timeslot.label,
    }));

    return (
        <Box sx={{ p: 2 }}>
            {content?.markdown}

            { !!timeslots &&
                <AvailabilityExpectations
                    availabilityEvents={timeslots}
                    eventStartTime={event.startTime}
                    eventEndTime={event.endTime}
                    eventTimezone={event.timeZone}
                    exceptionEvents={undefined}
                    exceptions={detailedApplicationInfo.preferences?.exceptions}
                    timing={undefined} /> }

            { !!timeslots && <Divider sx={{ mb: 3 }} /> }

            <FormProvider action={action} defaultValues={detailedApplicationInfo.preferences}>
                <Grid container spacing={2}>
                    <AvailabilityForm
                        includeBuildUp={detailedApplicationInfo.event.availabilityBuildUpEnabled}
                        includeTearDown={detailedApplicationInfo.event.availabilityTearDownEnabled}
                        readOnly={locked}
                        event={{
                            startTime: event.startTime.toString(),
                            endTime: event.endTime.toString(),
                            timeZone: event.timeZone,
                        }}
                        timeslots={{
                            limit: detailedApplicationInfo.settings.exceptionEventLimit,
                            open: true,
                            options: filteredTimeslots,
                        }} />
                </Grid>
                <FormSubmitButton callToAction="Save your preferences"
                                  startIcon={ <EventNoteIcon /> } sx={{ mt: 3, mb: 2 }} />
            </FormProvider>

            <MuiLink component={Link} href={`/registration/${event.slug}/application`}>
                « Back to your registration
            </MuiLink>

        </Box>
    );
}

export const generateMetadata = generatePortalMetadataFn('Availability preferences');
