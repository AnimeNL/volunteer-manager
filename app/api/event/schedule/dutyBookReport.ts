// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, unauthorized } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../../Types';
import { IncidentSummaryPrompt } from '@lib/ai/prompts';
import { Publish } from '@lib/subscriptions';
import { RecordErrorLog, RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { createAiClient } from '@lib/integrations/genai';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tDutyBook, tDutyBookViewers } from '@lib/database';

import { kSubscriptionType } from '@lib/subscriptions';

/**
 * Summary to use when no AI summary could be generated in a reasonable amount of time.
 */
const kUnableToGenerateSummary = 'No summary is available for this incident.';

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

        /**
         * Optional unique ID of the reported incident, when it could be created successfully.
         */
        incidentId: z.number().optional(),
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
            dutyBookAiSummary: kUnableToGenerateSummary,
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

    // Step 4: Generate an AI summary for the incident
    let incidentSummary = kUnableToGenerateSummary;

    try {
        const promptInstance = new IncidentSummaryPrompt();
        const prompt = await promptInstance.evaluate({
            incident: request.incident,
        });

        const client = await createAiClient();
        const summary = await client.generateText({ prompt });

        if (summary.success) {
            incidentSummary = summary.text;

            await dbInstance.update(tDutyBook)
                .set({
                    dutyBookAiSummary: incidentSummary,
                })
                .where(tDutyBook.dutyBookId.equals(incidentId))
                .executeUpdate();
        }
    } catch (error: any) {
        incidentSummary = kUnableToGenerateSummary;

        RecordErrorLog({
            error,
            requestUrl: { pathname: '/api/event/schedule/duty-book' },
            severity: kLogSeverity.Error,
            source: 'Server',
            user: props.user,
        });
    }

    // Step 4: Publish existence of the summary to subscribed volunteers
    await Publish({
        type: kSubscriptionType.Incident,
        sourceUserId: props.user.id,
        message: {
            author: props.user.name,
            summary: incidentSummary,
            requestId: incidentId,
        },
    });

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

    return {
        success: true,
        incidentId,
    };
}
