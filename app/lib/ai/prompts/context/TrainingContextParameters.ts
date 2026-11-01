// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { formatDate } from '@lib/Temporal';
import { tEvents, tTrainings } from '@lib/database';

/**
 * Parameters relaying context about a training session.
 */
export type TrainingContextParameters<FieldName extends string = 'training'> = {
    [K in FieldName]: {
        address?: string;
        date: string;
        startTime: string;
        endTime: string;
    };
};

/**
 * Example parameters that convey information about a training session.
 */
export const kTrainingContextExampleParameters: TrainingContextParameters['training'] = {
    address: 'De Broodfabriek, Volmerlaan 12, 2288 GD Rijswijk',
    date: '2026-04-04',
    startTime: '11:00',
    endTime: '17:00',
};

/**
 * Queries the training session context for the given `trainingId`. Will throw an exception when the
 * training session does not exist or has been hidden.
 */
export async function queryTrainingContext(db: DBConnection, trainingId: number)
    : Promise<TrainingContextParameters['training']>
{
    const training = await db.selectFrom(tTrainings)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tTrainings.eventId))
        .where(tTrainings.trainingId.equals(trainingId))
            .and(tTrainings.trainingVisible.equals(/* true= */ 1))
        .select({
            address: tTrainings.trainingAddress,
            start: tTrainings.trainingStart,
            end: tTrainings.trainingEnd,
            timezone: tEvents.eventTimezone,
        })
        .executeSelectOne();

    const start = training.start.withTimeZone(training.timezone);
    const end = training.end.withTimeZone(training.timezone);

    return {
        address: training.address,
        date: formatDate(start, 'YYYY-MM-DD'),
        startTime: formatDate(start, 'HH:mm'),
        endTime: formatDate(end, 'HH:mm'),
    };
}
