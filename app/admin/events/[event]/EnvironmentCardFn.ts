// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import type { BarSeriesType, ChartsReferenceLineProps, LineSeriesType } from '@mui/x-charts-pro';

import type { RemoteGraphFnReturn } from './finance/graphs/RemoteGraphFn';
import { Temporal, isAfter, isBefore } from '@lib/Temporal';
import { executeServerAction } from '@lib/serverAction';
import { readSetting } from '@lib/Settings';
import db, { tEvents, tEventsSales, tEventsSalesConfiguration, tUsersEvents } from '@lib/database';

import { kRemoteGraphColorScheme, kRemoteGraphLimitColour } from './finance/graphs/RemoteGraphFn';
import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Maximum space (as a fraction of 1) that is allowed to be wasted in favour of displaying the
 * product sales limit information.
 */
const kMaximumWastedVerticalSpace = 0.4;

/**
 * Server action used to fetch multi-year growth information for a particular team.
 */
export async function fetchTeamGrowth(eventId: number, eventSlug: string, teamId: number) {
    return executeServerAction(new FormData, z.object(), async (data: unknown, props) => {
        const permission = props.access.can('event.visible', {
            event: eventSlug,
            team: kAnyTeam,
        });

        if (!permission)
            return { success: false, error: 'No access to team information…' };

        return actuallyFetchTeamGrowth(eventId, teamId);
    });
}

/**
 * Actually fetches team growth information for the given |eventId| and |teamId|.
 */
async function actuallyFetchTeamGrowth(eventId: number, teamId: number)
    : Promise<RemoteGraphFnReturn>
{
    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Determine the date range for this sales graph. In order to maintain consistency across
    // different teams, we'll display the range between the first approved application and the
    // event's end date.
    // ---------------------------------------------------------------------------------------------

    const dateRange = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .where(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(tUsersEvents.registrationDate.isNotNull())
        .select({
            min: dbInstance.min(tUsersEvents.registrationDate),
            max: tEvents.eventEndTime,
        })
        .executeSelectNoneOrOne();

    if (!dateRange)
        return { success: false, error: 'Unable to determine the date range for this graph…' };
    if (!dateRange.min)
        return { success: false, error: 'Unable to determine the minimum date for this graph…' };

    const min = dateRange.min.toPlainDate();
    const max = dateRange.max.toPlainDate();

    // ---------------------------------------------------------------------------------------------

    // TODO: Multiple line charts for historic comparison
    // TODO: Bar graph for single-day applications

    // ---------------------------------------------------------------------------------------------

    const labels: string[] = [ /* no labels yet */ ];

    for (let date = min; !isAfter(date, max); date = date.add({ days: 1 }))
        labels.push(date.toString());

    const referenceLines: ChartsReferenceLineProps[] = [ /* none */ ];

    return {
        success: true,
        data: {
            referenceLines,
            series: [ /* none */ ],
            xAxis: {
                data: labels,
                scaleType: 'band',
            },
            yAxis: [
                {
                    position: 'left',
                    width: 50,
                },
            ],
        },
    };
}
