// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tActivities } from '@lib/database';

/**
 * Parameters relaying context about a program activity.
 */
export type ActivityContextParameters<FieldName extends string = 'activity'> = {
    [K in FieldName]: {
        description?: string;
        helpRequested: boolean;
        maxVisitors?: number;
        price?: number;
        rules?: string;
        title: string;
    };
};

/**
 * Example parameters that convey information about a program activity.
 */
export const kActivityContextExampleParameters: ActivityContextParameters['activity'] = {
    description: 'Learn how to quickly fix common cosplay wardrobe malfunctions on the go.',
    helpRequested: true,
    maxVisitors: 30,
    price: 5,
    rules: 'No hot glue guns allowed without supervision.',
    title: 'Cosplay Repair Workshop',
};

/**
 * Queries the activity context for the given `activityId`. Will throw an exception when the given
 * `activityId` does not exist or has been deleted.
 */
export async function queryActivityContext(db: DBConnection, activityId: number)
    : Promise<ActivityContextParameters['activity']>
{
    return db.selectFrom(tActivities)
        .where(tActivities.activityId.equals(activityId))
            .and(tActivities.activityDeleted.isNull())
        .select({
            description: tActivities.activityDescription,
            helpRequested: tActivities.activityHelpNeeded.equals(/* true= */ 1),
            maxVisitors: tActivities.activityMaxVisitors,
            price: tActivities.activityPrice,
            rules: tActivities.activityRules,
            title: tActivities.activityTitle,
        })
        .executeSelectOne();
}
