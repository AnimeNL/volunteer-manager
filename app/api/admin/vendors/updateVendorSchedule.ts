// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../../Types';
import { type VendorTeam, kVendorTeam } from '@lib/database/Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

import { kTemporalZonedDateTime } from '../../Types';

/**
 * Interface definition for the information contained within a vendor schedule.
 */
export const kVendorScheduleEntry = z.strictObject({
    /**
     * Unique ID of the schedule entry.
     */
    id: z.number(),

    /**
     * Unique ID of the vendor to whom this schedule entry belongs.
     */
    vendorId: z.number(),

    /**
     * Date and time on which the scheduled availability will start.
     */
    start: kTemporalZonedDateTime,

    /**
     * Date and time on which the scheduled availability will end.
     */
    end: kTemporalZonedDateTime,
});

/**
 * Type definition of the vendor schedule information.
 */
export type VendorScheduleEntry = z.input<typeof kVendorScheduleEntry>;

/**
 * Interface definition for the public Vendor API, exposed through /api/admin/vendors/schedule.
 */
export const kUpdateVendorScheduleDefinition = z.object({
    request: z.object({
        /**
         * Unique slug of the event for whom vendor schedules are being updated.
         */
        event: z.string(),

        /**
         * Team of vendors for whom the schedules are being updated.
         */
        team: z.enum(kVendorTeam),

        /**
         * Array of vendor Ids that were considered for this update, to help reduce race conditions.
         */
        resources: z.array(z.number()),

        /**
         * Array of schedule entries that should be stored to the database
         */
        schedule: z.array(kVendorScheduleEntry),
    }),
    response: z.object({
        /**
         * Whether the schedules could be updated successfully.
         */
        success: z.boolean(),

        /**
         * Optional message indicating what went wrong when a failure occurred.
         */
        error: z.string().optional(),
    }),
});

export type UpdateVendorScheduleDefinition = ApiDefinition<typeof kUpdateVendorScheduleDefinition>;

type Request = ApiRequest<typeof kUpdateVendorScheduleDefinition>;
type Response = ApiResponse<typeof kUpdateVendorScheduleDefinition>;

/**
 * API through which the schedules assigned to a particular team of vendors can be updated. All
 * entries will be updated in a singular API call, where this function will perform a diff.
 */
export async function updateVendorSchedule(request: Request, props: ActionProps): Promise<Response>
{
    const event = await getEventBySlug(request.event);
    if (!props.user || !event)
        notFound();

    const vendorsScheduleJoin = tVendorsSchedule.forUseInLeftJoin();

    const dbInstance = db;
    const knownResources = await dbInstance.selectFrom(tVendors)
        .leftJoin(vendorsScheduleJoin)
            .on(vendorsScheduleJoin.vendorId.equals(tVendors.vendorId))
                .and(vendorsScheduleJoin.vendorsScheduleDeleted.isNull())
        .where(tVendors.eventId.equals(event.id))
            .and(tVendors.vendorTeam.equals(request.team))
            .and(tVendors.vendorVisible.equals(/* true= */ 1))
        .select({
            id: tVendors.vendorId,
            schedule: dbInstance.aggregateAsArray({
                id: vendorsScheduleJoin.vendorsScheduleId,
                start: vendorsScheduleJoin.vendorsScheduleStart,
                end: vendorsScheduleJoin.vendorsScheduleEnd,
            }),
        })
        .groupBy(tVendors.vendorId)
        .executeSelectMany();

    const knownResourcesMap = new Map(
        knownResources.map(resource => [ resource.id, resource.schedule ]));

    await dbInstance.transaction(async () => {
        for (const resource of request.resources) {
            const knownSchedule = knownResourcesMap.get(resource) || [ /* empty */ ];
            const schedule = request.schedule.filter(period => period.vendorId === resource);

            const seenPeriods = new Set<number>;

            for (const period of schedule) {
                const knownPeriod = knownSchedule.find(({ id }) => period.id === id);

                // Step (1): Create new database entries for new work periods.
                if (period.id === 0 || !knownPeriod) {
                    await dbInstance.insertInto(tVendorsSchedule)
                        .set({
                            vendorId: resource,
                            vendorsScheduleStart: period.start,
                            vendorsScheduleEnd: period.end,
                            vendorsScheduleCreated: dbInstance.currentZonedDateTime(),
                            vendorsScheduleUpdated: dbInstance.currentZonedDateTime(),
                        })
                        .executeInsert();
                } else {
                    seenPeriods.add(period.id);

                    // Step (2): Update database entries where times have changed.
                    if (!knownPeriod.start.equals(period.start)
                            || !knownPeriod.end.equals(period.end)) {
                        await dbInstance.update(tVendorsSchedule)
                            .set({
                                vendorsScheduleStart: period.start,
                                vendorsScheduleEnd: period.end,
                                vendorsScheduleUpdated: dbInstance.currentZonedDateTime(),
                            })
                            .where(tVendorsSchedule.vendorsScheduleId.equals(knownPeriod.id))
                                .and(tVendorsSchedule.vendorsScheduleDeleted.isNull())
                            .executeUpdate();
                    }
                }
            }

            // Step (3): Remove database entries where they are no longer necessary.
            for (const knownPeriod of knownSchedule) {
                if (seenPeriods.has(knownPeriod.id))
                    continue;

                await dbInstance.update(tVendorsSchedule)
                    .set({
                        vendorsScheduleDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tVendorsSchedule.vendorsScheduleId.equals(knownPeriod.id))
                        .and(tVendorsSchedule.vendorsScheduleDeleted.isNull())
                    .executeUpdate();
            }
        }
    });

    ScheduleCache.clear('vendors', event.id);

    const kVendorTeamName: { [k in VendorTeam]: string } = {
        [kVendorTeam.FirstAid]: 'First Aid',
        [kVendorTeam.Security]: 'Security',
    };

    RecordLog({
        type: kLogType.AdminVendorScheduleUpdate,
        severity: kLogSeverity.Warning,
        sourceUser: props.user,
        data: {
            event: event.shortName,
            team: kVendorTeamName[request.team],
        },
    });

    return { success: true };
}
