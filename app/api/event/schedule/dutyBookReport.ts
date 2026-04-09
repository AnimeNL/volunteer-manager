// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, unauthorized } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tDutyBook, tDutyBookViewers } from '@lib/database';

/**
 * Interface definition for the Duty Book API, exposed through /api/event/schedule/duty-book
 */
export const kDutyBookReportDefinition = z.object({
    request: z.object({
        /**
         * Unique slug of the event for which the incident should be reported.
         */
        event: z.string(),

        /**
         * The incident that's being reported by the signed in user.
         */
        incident: z.string().min(8),
    }),
    response: z.strictObject({
        /**
         * Whether the entry could be saved in the database.
         */
        success: z.boolean(),

        /**
         * Optional error message in case the incident could not be reported.
         */
        error: z.string().optional(),
    }),
});

export type DutyBookReportDefinition = ApiDefinition<typeof kDutyBookReportDefinition>;

type Request = ApiRequest<typeof kDutyBookReportDefinition>;
type Response = ApiResponse<typeof kDutyBookReportDefinition>;

/**
 * API through which incident reports from volunteers will be uploaded.
 */
export async function dutyBookReport(request: Request, props: ActionProps): Promise<Response> {
    if (!props.user || !props.authenticationContext.user)
        unauthorized();

    const event = await getEventBySlug(request.event);
    if (!event)
        notFound();

    const dbInstance = db;

    // Step 1: Store the incident in the database
    const incidentId = await dbInstance.insertInto(tDutyBook)
        .values({
            dutyBookUserId: props.user.id,
            dutyBookEventId: event.id,
            dutyBookIncident: request.incident,
            dutyBookAiSummary: /* will be generated later= */ null,
            dutyBookCreated: dbInstance.currentZonedDateTime(),
            dutyBookUpdated: dbInstance.currentZonedDateTime(),
        })
        .returningLastInsertedId()
        .executeInsert();

    // Step 2: Mark the incident as read for the signed in user
    await dbInstance.insertInto(tDutyBookViewers)
        .values({
            dutyBookId: incidentId,
            dutyBookViewerUserId: props.user.id,
            dutyBookViewerDate: dbInstance.currentZonedDateTime(),
        })
        .onConflictDoNothing()
        .executeInsert();

    // Step 3: Publish existence of the summary to subscribed volunteers
    // TODO

    // Step 4: Generate an AI summary for the incident
    // TODO

    // Step 5: Log that a new incident has been reported
    RecordLog({
        type: kLogType.EventIncidentReported,
        severity: kLogSeverity.Warning,
        sourceUser: props.user,
        data: {
            event: event.shortName,
            incident: request.incident,
        },
    });

    return { success: true };
}
