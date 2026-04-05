// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { ConfirmationBox } from './ConfirmationBox';
import { formatDate } from '@lib/Temporal';
import db, { tHotels, tHotelsAssignments, tHotelsBookings, tUsers } from '@lib/database';

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

    const assignmentsJoin = tHotelsAssignments.forUseInLeftJoinAs('aj');
    const usersJoin = tUsers.forUseInLeftJoin();

    const bookings = await dbInstance.selectFrom(tHotelsAssignments)
        .innerJoin(tHotelsBookings)
            .on(tHotelsBookings.bookingId.equals(tHotelsAssignments.bookingId))
                .and(tHotelsBookings.bookingConfirmed.equals(/* true= */ 1))
                .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
        .innerJoin(tHotels)
            .on(tHotels.hotelId.equals(tHotelsBookings.bookingHotelId))
                .and(tHotels.hotelRoomDeleted.isNull())
        .leftJoin(assignmentsJoin)
            .on(assignmentsJoin.bookingId.equals(tHotelsBookings.bookingId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(assignmentsJoin.assignmentUserId))
        .where(tHotelsAssignments.eventId.equals(props.eventId))
            .and(tHotelsAssignments.assignmentUserId.equals(props.userId))
        .select({
            booking: {
                checkIn: tHotelsBookings.bookingCheckIn,
                checkOut: tHotelsBookings.bookingCheckOut,
                hotel: {
                    name: tHotels.hotelName,
                    room: tHotels.hotelRoomName,
                },
            },
            sharing: db.aggregateAsArray({
                userId: assignmentsJoin.assignmentUserId,
                name: assignmentsJoin.assignmentName.valueWhenNull(usersJoin.name),
            }),
        })
        .groupBy(tHotelsAssignments.bookingId)
        .orderBy('booking.checkIn', 'asc')
        .executeSelectMany();

    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="h5">
                Your confirmed booking{ bookings.length > 1 ? 's' : '' }
            </Typography>
            { bookings.map(({ booking, sharing }, index) => {
                const primary = `${booking.hotel.name} (${booking.hotel.room})`;
                const secondary =
                    `Check in on ${formatDate(booking.checkIn, 'dddd, MMMM D')}, check out on ` +
                    `${formatDate(booking.checkOut, ' dddd, MMMM D')}`;

                const others = sharing.filter(v => v.userId !== props.userId);
                const otherNames = others.map(v => v.name);

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
