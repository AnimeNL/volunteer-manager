// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory } from '@lib/database/Types';

/**
 * Object containing the valid event sale categories, together with a human readable description of
 * what they represent. This object is used to populate the dropdown in the sales configuration.
 */
export const kEventTicketCategoryOptions: { [k in EventTicketCategory]: string } = {
    Event: 'Event',
    Hidden: 'Hidden',
    Locker: 'Locker',
    LockerFriday: 'Locker (Friday)',
    LockerSaturday: 'Locker (Saturday)',
    LockerSunday: 'Locker (Sunday)',
    LockerWeekend: 'Locker (Weekend)',
    TicketFriday: 'Ticket (Friday)',
    TicketSaturday: 'Ticket (Saturday)',
    TicketSunday: 'Ticket (Sunday)',
    TicketVolunteers: 'Ticket (Volunteers)',
    TicketWeekend: 'Ticket (Weekend)',
};
