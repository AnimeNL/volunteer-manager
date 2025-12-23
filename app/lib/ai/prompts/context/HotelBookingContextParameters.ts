// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Parameters relaying context about a hotel room booking.
 */
export type HotelBookingContextParameters = {
    hotel: {
        checkInDate: string;
        checkOutDate: string;

        secondOccupant?: string;
        thirdOccupant?: string;

        name: string;
        roomName: string;
        roomPrice: number;
    };
};

/**
 * Example parameters that convey information about the person's hotel room booking.
 */
export const kHotelBookingContextExampleParameters: HotelBookingContextParameters = {
    hotel: {
        checkInDate: '2026-04-17',
        checkOutDate: '2026-04-19',

        secondOccupant: 'Theresa',
        thirdOccupant: 'Angela',

        name: 'Bastion Hotel Rijswijk',
        roomName: 'Deluxe Twin Room',
        roomPrice: 160,
    },
};
