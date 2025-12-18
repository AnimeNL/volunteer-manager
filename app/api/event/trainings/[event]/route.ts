// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { z } from 'zod/v4';

import type { ActionProps } from '../../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../../../Types';
import { executeAction } from '../../../Action';
import { formatDate } from '@lib/Temporal';
import db, { tEvents, tTrainings } from '@lib/database';

/**
 * Interface definition for the Trainings API, exposed through /api/event/trainings.
 */
const kTrainingsDefinition = z.object({
    request: z.object({
        /**
         * Unique slug of the event for which to fetch training information.
         */
        event: z.string(),
    }),
    response: z.strictObject({
        /**
         * The training sessions which have availability for this event.
         */
        trainings: z.array(z.string()),
    }),
});

export type TrainingsDefinition = ApiDefinition<typeof kTrainingsDefinition>;

type Request = ApiRequest<typeof kTrainingsDefinition>;
type Response = ApiResponse<typeof kTrainingsDefinition>;

/**
 * API through which visitors can retrieve information about the trainings available for an event.
 */
async function trainings(request: Request, props: ActionProps): Promise<Response> {
    const configuration = await db.selectFrom(tTrainings)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tTrainings.eventId))
            .and(tEvents.eventSlug.equals(request.event))
        .where(tTrainings.trainingVisible.equals(/* true= */ 1))
        .select({
            published: tEvents.trainingInformationPublished,
            timezone: tEvents.eventTimezone,

            start: tTrainings.trainingStart,
            end: tTrainings.trainingEnd,
        })
        .orderBy('start', 'asc')
        .executeSelectMany();

    const trainings: Response['trainings'] = [];
    for (const row of configuration) {
        if (!row.published && !props.access.can('event.trainings', { event: request.event }))
            continue;  // this `row` has not yet been published

        const date = formatDate(row.start.withTimeZone(row.timezone), 'dddd, MMMM D');
        const start = formatDate(row.start.withTimeZone(row.timezone), 'H:mm');
        const end = formatDate(row.end.withTimeZone(row.timezone), 'H:mm');

        trainings.push(`${date}, from ${start} until ${end}`);
    }

    return { trainings };
}

/**
 * The /api/event/trainings/[event] endpoint exposes a read-only version of the training data.
 */
export async function GET(
    request: NextRequest, context: RouteContext<'/api/event/trainings/[event]'>)
{
    return executeAction(request, kTrainingsDefinition, trainings, await context.params);
}
