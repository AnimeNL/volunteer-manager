// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '../../requireAuthenticationWithEventAndTeam';
import db, { tVendors, tVendorsSchedule } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';
import { kVendorTeam, type VendorTeam } from '@lib/database/Types';

/**
 * Names of the known vendor teams, for presentation in user interfaces.
 */
const kVendorTeamName: { [k in VendorTeam]: string } = {
    [kVendorTeam.FirstAid]: 'First Aid',
    [kVendorTeam.Security]: 'Security',
};

/**
 * Zod schema describing the parameters required to create a new shift.
 */
const kUpdateVendorSchedule = z.object({
    resources: z.array(z.number()),
    schedule: z.array(z.object({
        id: z.number(),
        vendorId: z.number(),
        start: kTemporalZonedDateTime,
        end: kTemporalZonedDateTime,
    })),
});

/**
 * Server Action to update the schedule for a vendor team.
 */
export async function updateVendorSchedule(
    eventSlug: string, teamSlug: string, vendorTeam: VendorTeam, formData: unknown)
{
    return executeServerAction(formData, kUpdateVendorSchedule, async (data, props) => {
        const { event } = await requireAuthenticationWithEventAndTeam(
            eventSlug, teamSlug, props.authenticationContext, {
                permission: 'event.vendors',
                operation: 'update',
            });

        const vendorsScheduleJoin = tVendorsSchedule.forUseInLeftJoin();

        const dbInstance = db;
        const knownResources = await dbInstance.selectFrom(tVendors)
            .leftJoin(vendorsScheduleJoin)
                .on(vendorsScheduleJoin.vendorId.equals(tVendors.vendorId))
                    .and(vendorsScheduleJoin.vendorsScheduleDeleted.isNull())
            .where(tVendors.eventId.equals(event.id))
                .and(tVendors.vendorTeam.equals(vendorTeam))
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
            for (const resource of data.resources) {
                const knownSchedule = knownResourcesMap.get(resource) || [ /* empty */ ];
                const schedule = data.schedule.filter(period => period.vendorId === resource);

                const seenPeriods = new Set<number>();

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

        LogBuilder.for('UpdateVendorSchedule')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                vendor: kVendorTeamName[vendorTeam],
            });

        return { success: true };
    });
}
