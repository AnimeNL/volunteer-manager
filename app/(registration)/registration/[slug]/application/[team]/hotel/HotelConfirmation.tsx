// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { ConfirmationBox } from './ConfirmationBox';
import { formatDate } from '@lib/Temporal';
import db, { tHotels, tHotelsBookings, tUsers } from '@lib/database';

/**
 * Props accepted by the <HotelConfirmation> component.
 */
interface HotelConfirmationProps {
    /**
     * Unique ID of the event for which bookings should be considered.
     */
    eventId: number;

    /**
     * Unique ID of the user for whom bookings should be shown.
     */
    userId: number;
}

/**
 * The <HotelConfirmation> component displays the confirmed hotel room bookings for the volunteer.
 * It's possible for there to be multiple bookings, in case they stay longer than the weekend.
 */
export async function HotelConfirmation(props: HotelConfirmationProps) {
    const dbInstance = db;

    const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');
    const secondUserJoin = tUsers.forUseInLeftJoinAs('su');
    const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

    const bookings = await dbInstance.selectFrom(tHotelsBookings)
        .innerJoin(tHotels)
            .on(tHotels.hotelId.equals(tHotelsBookings.bookingHotelId))
                .and(tHotels.hotelRoomDeleted.isNull())
        .leftJoin(firstUserJoin)
            .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
        .leftJoin(secondUserJoin)
            .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
        .leftJoin(thirdUserJoin)
            .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
        .where(tHotelsBookings.eventId.equals(props.eventId))
            .and(tHotelsBookings.bookingConfirmed.isNotNull())
            .and(tHotelsBookings.bookingDeleted.isNull())
            .and(tHotelsBookings.bookingFirstUserId.equals(props.userId).or(
                tHotelsBookings.bookingSecondUserId.equals(props.userId)).or(
                tHotelsBookings.bookingThirdUserId.equals(props.userId)))
        .select({
            checkIn: tHotelsBookings.bookingCheckIn,
            checkOut: tHotelsBookings.bookingCheckOut,
            hotel: {
                name: tHotels.hotelName,
                room: tHotels.hotelRoomName,
            },
            firstUserId: tHotelsBookings.bookingFirstUserId,
            firstName: tHotelsBookings.bookingFirstName.valueWhenNull(firstUserJoin.name),
            secondUserId: tHotelsBookings.bookingSecondUserId,
            secondName: tHotelsBookings.bookingSecondName.valueWhenNull(secondUserJoin.name),
            thirdUserId: tHotelsBookings.bookingThirdUserId,
            thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(thirdUserJoin.name),
        })
        .orderBy('checkIn', 'asc')
        .executeSelectMany();

    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="h5">
                Your confirmed booking{ bookings.length > 1 ? 's' : '' }
            </Typography>
            { bookings.map((booking, index) => {
                const primary = `${booking.hotel.name} (${booking.hotel.room})`;
                const secondary =
                    `Check in on ${formatDate(booking.checkIn, 'dddd, MMMM D')}, check out on ` +
                    `${formatDate(booking.checkOut, ' dddd, MMMM D')}`;

                const otherNames: string[] = [];
                if (booking.firstUserId !== props.userId && !!booking.firstName)
                    otherNames.push(booking.firstName);
                if (booking.secondUserId !== props.userId && !!booking.secondName)
                    otherNames.push(booking.secondName);
                if (booking.thirdUserId !== props.userId && !!booking.thirdName)
                    otherNames.push(booking.thirdName);

                const tertiary =
                    !!otherNames.length
                        ? `You'll share this room with ${otherNames.join(' & ')}`
                        : 'You won\'t share this room with anyone';

                return <ConfirmationBox key={index} primary={primary} secondary={secondary}
                                        tertiary={tertiary} />;
            }) }
        </Box>
    );
}
