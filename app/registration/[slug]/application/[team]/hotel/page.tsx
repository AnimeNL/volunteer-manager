// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden, notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import { AvailabilityWarning } from '../AvailabilityWarning';
import { FormProvider } from '@components/FormProvider';
import { HotelConfirmation } from './HotelConfirmation';
import { HotelPreferences } from './HotelPreferences';
import { Markdown } from '@components/Markdown';
import { Temporal, isAfter, isBefore } from '@lib/Temporal';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import { getHotelRoomOptions } from './getHotelRoomOptions';
import { getStaticContent } from '@lib/Content';
import db, { tEvents, tUsersEvents, tRoles, tHotelsPreferences, tHotelsAssignments,
    tHotelsBookings } from '@lib/database';

import * as actions from '../../ApplicationActions';

/**
 * The <EventApplicationHotelsPage> component serves the ability for users to select which hotel
 * they would like to stay in during the event. Not all volunteers have the ability to make this
 * selection, as the number of available hotel rooms is limited.
 */
export default async function EventApplicationHotelsPage(
    props: PageProps<'/registration/[slug]/application/[team]/hotel'>)
{
    const { access, event, team, user } = await getApplicationContext(props);

    const currentTime = Temporal.Now.zonedDateTimeISO('utc');
    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Fetch some detailed information necessary to process this page, specifically settings in
    // context of hotel allocation, and whether the user has an existing reservation (request).
    // ---------------------------------------------------------------------------------------------

    const hotelAssignmentsJoin = tHotelsAssignments.forUseInLeftJoin();
    const hotelBookingsJoin = tHotelsBookings.forUseInLeftJoin();
    const hotelPreferencesJoin = tHotelsPreferences.forUseInLeftJoin();

    const data = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(hotelPreferencesJoin)
            .on(hotelPreferencesJoin.userId.equals(tUsersEvents.userId))
                .and(hotelPreferencesJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(hotelAssignmentsJoin)
            .on(hotelAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
                .and(hotelAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(hotelBookingsJoin)
            .on(hotelBookingsJoin.bookingId.equals(hotelAssignmentsJoin.bookingId))
                .and(hotelBookingsJoin.bookingConfirmed.equals(/* true= */ 1))
                .and(hotelBookingsJoin.bookingVisible.equals(/* true= */ 1))
        .where(tUsersEvents.userId.equals(user.id))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
        .select({
            bookings: dbInstance.countDistinct(hotelBookingsJoin.bookingId),
            preferences: {
                checkIn: dbInstance.dateAsString(hotelPreferencesJoin.hotelDateCheckIn),
                checkOut: dbInstance.dateAsString(hotelPreferencesJoin.hotelDateCheckOut),
                hotelId: hotelPreferencesJoin.hotelId,
                sharingPeople: hotelPreferencesJoin.hotelSharingPeople,
                sharingPreferences: hotelPreferencesJoin.hotelSharingPreferences,
            },
            settings: {
                availability: {
                    start: tEvents.hotelPreferencesStart,
                    end: tEvents.hotelPreferencesEnd,
                },
                detailsPublished: tEvents.hotelInformationPublished,
                eligible: tUsersEvents.hotelEligible.valueWhenNull(tRoles.roleHotelEligible),
                enabled: tEvents.hotelEnabled,
            },
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!data || !data.settings.enabled)
        notFound();

    const { bookings, preferences, settings } = data;

    // ---------------------------------------------------------------------------------------------
    // Decide whether the volunteer has the ability to access the hotel preferences page, and
    // whether the page should be shown in read-only mode versus being fully editable.
    // ---------------------------------------------------------------------------------------------

    let locked: boolean = bookings > 0;

    if (!access.can('event.hotels', { event: event.slug })) {
        if (!settings.detailsPublished || !settings.availability?.start)
            forbidden();  // details have not been published yet, but do tease existence

        if (isBefore(currentTime, settings.availability.start))
            forbidden();  // the availability window has not opened yet

        if (!!settings.availability.end && isAfter(currentTime, settings.availability.end))
            locked = true;  // the availability window has closed
    }

    // ---------------------------------------------------------------------------------------------

    const content = await getStaticContent([ 'registration', 'application', 'hotel' ], {
        firstName: user.nameOrFirstName,
    });

    const defaultValues = {
        interested: !!preferences ? 1 : 0,
        ...preferences,
    };

    const action = actions.updateHotelPreferences.bind(null, event.id, team.id);
    const rooms = await getHotelRoomOptions(event.id);

    return (
        <Stack spacing={2} sx={{ p: 2 }}>

            { !settings.detailsPublished &&
                <Alert severity="warning">
                    Details about the available hotel rooms have not been published yet, which may
                    result in this page appearing incomplete or broken.
                </Alert> }

            { !bookings &&
                <AvailabilityWarning currentTime={currentTime} window={settings.availability} /> }

            { !!content && <Markdown>{content.markdown}</Markdown> }

            { !!bookings && <HotelConfirmation eventId={event.id} userId={user.id} /> }

            { (!!settings.eligible || !!bookings) &&
                <FormProvider action={action} defaultValues={defaultValues}>
                    <HotelPreferences eventDate={event.startTime.toString()}
                                      readOnly={locked} rooms={rooms} />
                </FormProvider> }

            <MuiLink component={Link} href={`/registration/${event.slug}/application/${team.slug}`}>
                « Back to your registration
            </MuiLink>
        </Stack>
    );
}

export const generateMetadata = generatePortalMetadataFn('Hotel preferences');
