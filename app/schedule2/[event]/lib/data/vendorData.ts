// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent, CachedVendorShift } from '@lib/cache';
import type { VendorTeam } from '@lib/database/Types';
import { Cache } from '@lib/cache';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

/**
 * Loads all scheduled shifts for visible vendors in `eventId`, backed by the permanent
 * `VolunteerPortal` cache and deduplicated per request with React's `cache()`.
 */
const loadVendorShifts = cache(
    async (eventId: number): Promise<CachedVendorShift[]> => {
        const shifts = await Cache.getInstance('VolunteerPortal').getOrInsert(
            { eventId, type: 'vendors' },
            async () =>
                await db.selectFrom(tVendorsSchedule)
                    .innerJoin(tVendors)
                        .on(tVendors.vendorId.equals(tVendorsSchedule.vendorId))
                            .and(tVendors.eventId.equals(eventId))
                            .and(tVendors.vendorVisible.equals(/* true= */ 1))
                    .where(tVendorsSchedule.vendorsScheduleDeleted.isNull())
                    .select({
                        vendorId: tVendors.vendorId,
                        type: tVendors.vendorTeam,
                        firstName: tVendors.vendorFirstName,
                        lastName: tVendors.vendorLastName,
                        start: tVendorsSchedule.vendorsScheduleStart,
                        end: tVendorsSchedule.vendorsScheduleEnd,
                    })
                    .executeSelectMany());

        return shifts ?? [];
    });

/**
 * Returns the alphabetically sorted first names of vendors belonging to `team` who are currently
 * on-site at `currentTime` for `event`.
 */
export async function getActiveVendors(
    event: Pick<CachedEvent, 'id'>,
    team: VendorTeam,
    currentTime: Temporal.ZonedDateTime): Promise<string[]>
{
    const shifts = await loadVendorShifts(event.id);
    const activeByVendorId = new Map<number, string>();

    for (const shift of shifts) {
        if (shift.type !== team)
            continue;

        if (Temporal.ZonedDateTime.compare(shift.start, currentTime) <= 0 &&
                Temporal.ZonedDateTime.compare(shift.end, currentTime) > 0) {
            activeByVendorId.set(shift.vendorId, shift.firstName);
        }
    }

    return [ ...activeByVendorId.values() ].sort((lhs, rhs) => lhs.localeCompare(rhs));
}
