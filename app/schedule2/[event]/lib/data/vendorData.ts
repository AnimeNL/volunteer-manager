// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent, CachedVendorShift } from '@lib/cache';
import type { VendorTeam } from '@lib/database/Types';
import { Cache } from '@lib/cache';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

/**
 * Serializable representation of a scheduled vendor team member for calendar display.
 */
interface VendorScheduleMember {
    id: number;
    name: string;
}

/**
 * Serializable representation of a single scheduled vendor shift for calendar display.
 */
interface VendorScheduleShift {
    end: string;
    id: string;
    start: string;
    vendorId: number;
}

/**
 * Full schedule for a vendor team, containing its scheduled members and their shifts.
 */
interface VendorScheduleData {
    shifts: VendorScheduleShift[];
    vendors: VendorScheduleMember[];
}

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

/**
 * Returns whether `team` has at least one scheduled shift in `event`.
 */
export async function hasVendorSchedule(
    event: Pick<CachedEvent, 'id'>,
    team: VendorTeam): Promise<boolean>
{
    const shifts = await loadVendorShifts(event.id);
    return shifts.some(shift => shift.type === team);
}

/**
 * Returns the full serializable schedule for `team` in `event`, including all scheduled vendors
 * (with full names, sorted alphabetically) and their shifts (sorted chronologically as ISO instant
 * strings).
 */
export async function getVendorSchedule(
    event: Pick<CachedEvent, 'id'>,
    team: VendorTeam): Promise<VendorScheduleData>
{
    const allShifts = await loadVendorShifts(event.id);
    const teamShifts = allShifts.filter(shift => shift.type === team);
    if (!teamShifts.length)
        return { shifts: [], vendors: [] };

    const vendorsById = new Map<number, string>();
    for (const shift of teamShifts) {
        if (!vendorsById.has(shift.vendorId))
            vendorsById.set(shift.vendorId, `${shift.firstName} ${shift.lastName}`.trim());
    }

    const vendors: VendorScheduleMember[] = [ ...vendorsById.entries() ]
        .map(([ id, name ]) => ({ id, name }))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    const sortedShifts = [ ...teamShifts ].sort((lhs, rhs) =>
        Temporal.ZonedDateTime.compare(lhs.start, rhs.start) ||
        Temporal.ZonedDateTime.compare(lhs.end, rhs.end) ||
        lhs.vendorId - rhs.vendorId);

    const shifts: VendorScheduleShift[] = sortedShifts.map((shift, index) => ({
        end: shift.end.toInstant().toString(),
        id: `${shift.vendorId}:${shift.start.epochMilliseconds}:${index}`,
        start: shift.start.toInstant().toString(),
        vendorId: shift.vendorId,
    }));

    return { shifts, vendors };
}
