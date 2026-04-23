// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeServerAction } from '@lib/serverAction';
import db, { tEnvironments, tEnvironmentsEvents, tEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * The data associated with website settings for a particular environment and event.
 */
const kWebsiteSettingsData = z.object({
    /**
     * Moment in time, if any, at which we'll start to accept applications.
     */
    acceptApplicationsStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which applications will no longer be accepted.
     */
    acceptApplicationsEnd: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which the registration portal will be published.
     */
    publishContentStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which the registration portal will cease to be available.
     */
    publishContentEnd: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which the schedule portal will be available.
     */
    publishPortalStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which the schedule portal will be closed again.
     */
    publishPortalEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action called when website settings for a particular event and environment are being
 * updated by a lead. Changes will take effect immediately.
 */
export async function updateSettings(eventId: number, environmentId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kWebsiteSettingsData, async (data, props) => {
        const dbInstance = db;

        const metadata = await dbInstance.selectFrom(tEvents)
            .innerJoin(tEnvironments)
                .on(tEnvironments.environmentId.equals(environmentId))
            .where(tEvents.eventId.equals(eventId))
            .select({
                domain: tEnvironments.environmentDomain,
                eventName: tEvents.eventName,
            })
            .executeSelectNoneOrOne();

        if (!metadata)
            notFound();

        await db.insertInto(tEnvironmentsEvents)
            .set({
                environmentId, eventId,
                environmentAcceptApplicationsStart: data.acceptApplicationsStart,
                environmentAcceptApplicationsEnd: data.acceptApplicationsEnd,
                environmentPublishContentStart: data.publishContentStart,
                environmentPublishContentEnd: data.publishContentEnd,
                environmentPublishPortalStart: data.publishPortalStart,
                environmentPublishPortalEnd: data.publishPortalEnd,
            })
            .onConflictDoUpdateSet({
                environmentAcceptApplicationsStart: data.acceptApplicationsStart,
                environmentAcceptApplicationsEnd: data.acceptApplicationsEnd,
                environmentPublishContentStart: data.publishContentStart,
                environmentPublishContentEnd: data.publishContentEnd,
                environmentPublishPortalStart: data.publishPortalStart,
                environmentPublishPortalEnd: data.publishPortalEnd,
            })
            .executeInsert();

        RecordLog({
            type: kLogType.AdminEventWebsiteSettingsUpdate,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: metadata,
        });

        return { success: true, refresh: true };
    });
}
