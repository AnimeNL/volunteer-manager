// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import type { BarSeriesType, ChartsReferenceLineProps, LineSeriesType } from '@mui/x-charts-pro';

import type { RemoteGraphFnReturn } from './finance/graphs/RemoteGraphFn';
import { Temporal, isAfter, isBefore } from '@lib/Temporal';
import { executeServerAction } from '@lib/serverAction';
import db, { tEvents, tEventsDates, tUsersEvents } from '@lib/database';

import { kAnyTeam } from '@lib/auth/AccessList';
import { kDateType, kRegistrationStatus } from '@lib/database/Types';
import { kProductHighlightColors } from './finance/graphs/ProductHighlightColors';

/**
 * Which colours should the edition series be rendered in? More recent series (first entries) should
 * be more pronounced on the graph than later series (later entries).
 */
const kComparisonEditionColours: string[] = [
    '#b71c1cff',  // red 900
    '#455a6490',  // blueGrey 700
    '#78909c70',  // blueGrey 400
    '#b0bec570',  // blueGrey 200
];

/**
 * Number of historic events to include in the graph, for comparison purposes.
 */
const kHistoricEventCount = kComparisonEditionColours.length - 1;

/**
 * Server action used to fetch multi-year growth information for a one or more teams.
 */
export async function fetchTeamGrowth(
    eventId: number, eventSlug: string, teamIds: number[], cumulative: boolean)
        : Promise<RemoteGraphFnReturn>
{
    return executeServerAction(new FormData, z.object(), async (data: unknown, props) => {
        const permission = props.access.can('event.visible', {
            event: eventSlug,
            team: kAnyTeam,
        });

        if (!permission)
            return { success: false, error: 'No access to team information…' };

        return actuallyFetchTeamGrowth(eventId, teamIds, cumulative);

    }) as Promise<RemoteGraphFnReturn>;
}

/**
 * Actually fetches team growth information for the given |eventId| and |teamIds|. When the
 * |cumulative| flag is set, total lines for each of the sold products will be included as well.
 */
async function actuallyFetchTeamGrowth(eventId: number, teamIds: number[], cumulative: boolean)
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

    const currentDay = Temporal.Now.plainDateISO();

    const totalDisplayDays = min.until(max, { largestUnit: 'days' }).days;

    // ---------------------------------------------------------------------------------------------
    // Prepare the base information.
    // ---------------------------------------------------------------------------------------------

    // The bar graphs that should be shown on the graph, populated for each event.
    const bars: Map<number, BarSeriesType & { data: (number | null)[] }> = new Map();

    // The line graphs that should be shown on the graph, populated for each event.
    const lines: Map<number, LineSeriesType & { data: (number | null)[] }> = new Map();

    // The maximum number of volunteers shown in the graph.
    let maximum = Number.MIN_SAFE_INTEGER;

    // Reference lines that should be shown on the graph. Can be for any reason.
    const referenceLines: ChartsReferenceLineProps[] = [ /* none */ ];

    // ---------------------------------------------------------------------------------------------
    // For each of the |kHistoricEventCount| past events, as well as the latest one, compute the
    // number of accepted participants in the team based on their registration status.
    // ---------------------------------------------------------------------------------------------

    const daysFromEvent = dbInstance.fragmentWithType('int', 'optional')
        .sql`DATEDIFF(${tEvents.eventEndTime}, ${tUsersEvents.registrationDate})`;

    const applicationsByEvent = await dbInstance.selectFrom(tEvents)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.eventId.equals(tEvents.eventId))
                .and(tUsersEvents.teamId.in(teamIds))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(tUsersEvents.registrationDate.isNotNull())
                .and(tUsersEvents.registrationDate.lessOrEquals(tEvents.eventEndTime))
        .where(tEvents.eventId.lessOrEquals(eventId))
        .select({
            event: {
                id: tEvents.eventId,
                name: tEvents.eventShortName,
            },
            applications: dbInstance.aggregateAsArrayOfOneColumn(daysFromEvent),
        })
        .groupBy(tEvents.eventId)
        .orderBy(tEvents.eventEndTime, 'desc')
            .limit(kHistoricEventCount + 1)
        .executeSelectMany();

    for (const { event, applications } of applicationsByEvent) {
        applications.sort((lhs, rhs) => lhs - rhs).reverse();

        const barData: (number | null)[] = [ /* to be populated */ ];
        const lineData: (number | null)[] = [ /* to be populated */ ];

        let runningTotal = 0;

        for (let day = totalDisplayDays; day >= 0; --day) {
            let applicationsOnThisDay = 0;
            while (!!applications.length && applications[0] >= day) {
                applications.shift();

                applicationsOnThisDay++;
                runningTotal++;
            }

            barData.push(applicationsOnThisDay > 0 ? applicationsOnThisDay : null);

            // Update the |maximum| with the latest computed |runningTotal|.
            maximum = Math.max(runningTotal, maximum);

            // If the |event| represents the current event, there aren't any (future) applications,
            // and the current |day| lies in the future, intentionally break the line.
            if (event.id === eventId && !applications.length) {
                if (Temporal.PlainDate.compare(currentDay, max.subtract({ days: day })) < 0) {
                    lineData.push(null);
                    continue;
                }
            }

            // Append a NULL when the |runningTotal| is still zero, as applications would not have
            // opened yet. Conversely, append the total number of applications, and correct the
            // previous entry if |lineData| already has values & this is the first day with numbers.
            if (!runningTotal) {
                lineData.push(null);
                continue;
            }

            if (!!lineData.length && lineData[lineData.length - 1] === null)
                lineData[lineData.length - 1] = 0;

            lineData.push(runningTotal);
        }

        lines.set(event.id, {
            type: 'line',
            color: kComparisonEditionColours[lines.size],
            label: event.name,
            data: lineData,
        });

        bars.set(event.id, {
            type: 'bar',
            color: kComparisonEditionColours[bars.size],
            label: event.name,
            data: barData,
            stack: 'day',
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Determine any highlights that should be displayed on the graph. These can be controlled
    // through the event settings, and are useful for visualising e.g. social media activity.
    // ---------------------------------------------------------------------------------------------

    const highlights = await dbInstance.selectFrom(tEventsDates)
        .where(tEventsDates.eventId.equals(eventId))
            .and(tEventsDates.dateType.in([ kDateType.Highlight, kDateType.HighlightVolunteers ]))
            .and(tEventsDates.dateDeleted.isNull())
        .select({
            date: dbInstance.dateAsString(tEventsDates.dateDate),
            label: tEventsDates.dateTitle,
        })
        .orderBy(tEventsDates.dateDate, 'asc')
        .executeSelectMany();

    for (const { date, label } of highlights) {
        const colour =
            kProductHighlightColors[referenceLines.length % kProductHighlightColors.length];

        referenceLines.push({
            label,
            labelAlign: 'start',
            labelStyle: {
                fill: `${colour}aa`,
                fontSize: '12px',
                textAnchor: 'end',
            },
            lineStyle: {
                stroke: `${colour}50`,
            },
            spacing: { x: -2, y: 5 },
            x: date,
        });
    }

    // ---------------------------------------------------------------------------------------------

    const labels: string[] = [ /* no labels yet */ ];

    for (let date = min; !isAfter(date, max); date = date.add({ days: 1 }))
        labels.push(date.toString());

    // Add a reference line for the current day if |currentDay| lies within |min| and |max|.
    if (isBefore(min, currentDay) && isAfter(max, currentDay)) {
        referenceLines.push({
            labelStyle: {
                fill: 'blue',
                fontSize: '12px',
            },
            lineStyle: {
                strokeDasharray: 2,
                stroke: '#0097A7AA',
            },
            x: currentDay.toString(),
        });
    }

    // ---------------------------------------------------------------------------------------------

    if (!cumulative)
        lines.clear();

    return {
        success: true,
        data: {
            referenceLines,
            series: [
                ...lines.values(),
                ...bars.values(),
            ],
            xAxis: {
                data: labels,
                scaleType: 'band',
                tickLabelPlacement: 'tick',
                tickPlacement: 'middle',
                tickSpacing: 50,
                zoom: true,
            },
            yAxis: [
                {
                    position: 'left',
                    max: (!!cumulative && maximum > 0) ? Math.floor(maximum * 1.15) : undefined,
                    width: 50,
                },
            ],
        },
    };
}
