// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NextRequest, NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { LineSeriesType } from '@mui/x-charts-pro';

import type { ApiDefinition, ApiRequest, ApiResponse } from '../../../../Types';
import { type ActionProps, executeAction } from '../../../../Action';
import { Temporal, formatDate } from '@lib/Temporal';
import { createVertexAIClient } from '@lib/integrations/vertexai';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getTicketSalesComparisonSeries } from '@app/admin/events/[event]/finance/graphs/TicketSalesComparisonGraph';
import { readSetting } from '@lib/Settings';
import db, { tEvents } from '@lib/database';

/**
 * Interface definition for the Financial Insights API.
 */
const kFinancialInsightsDefinition = z.object({
    request: z.object({
        /**
         * The events for which financial insights should be generated.
         */
        events: z.array(z.object({
            /**
             * Unique ID of the event as it exists in the database.
             */
            id: z.number(),

            /**
             * Label that represents the name of the event.
             */
            name: z.string(),

            /**
             * Set of products that are in scope for the comparison for this event.
             */
            products: z.array(z.number()),
        })),
    }),
    response: z.strictObject({
        /**
         * Whether the insights were able to be generated.
         */
        success: z.boolean(),

        /**
         * Error message in case the insights could not be generated.
         */
        error: z.string().optional(),

        /**
         * The insights that were generated, when `success` has been set to `true`.
         */
        insights: z.string().optional(),
    }),
});

export type FinancialInsightsDefinition = ApiDefinition<typeof kFinancialInsightsDefinition>;

type Request = ApiRequest<typeof kFinancialInsightsDefinition>;
type Response = ApiResponse<typeof kFinancialInsightsDefinition>;

/**
 * Converts the given `series` to a string that represents the CSV contents of the data. This data
 * will be fed into the AI model to generate insights and predictions.
 */
function seriesToCsv(series: LineSeriesType[]): string {
    const headers: string[] = [ /* no headers yet */ ];
    const data: number[][] = [ /* no data yet */ ];

    let length = 0;
    for (const serie of series) {
        if (Array.isArray(serie.data))
            length = Math.max(length, serie.data.length);
    }

    for (const serie of series) {
        if (typeof serie.label !== 'string' || !Array.isArray(serie.data))
            throw new Error(`Series ${headers.length} does not have a textual label or data`);

        headers.push(serie.label);

        for (let index = 0; index < length; ++index) {
            const value = serie.data.length <= index ? null : serie.data[index];

            !data[index] ? data[index] = [ value ]
                         : data[index].push(value);
        }
    }

    const lines = [
        `"Days until event",${headers.map(v => `"${v}"`).join(',')}`,
        ...data.map((points, index) => `${data.length - index - 1},${points.join(',')}`),
    ];

    return lines.join('\n');
}

/**
 * The /api/admin/event/finance/insights endpoint exposes an API that allows for automatically
 * generating insights on the sales information for a particular event.
 */
async function financialInsights(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, { permission: 'statistics.finances' });

    if (!request.events.length)
        notFound();

    // ---------------------------------------------------------------------------------------------

    const events = await db.selectFrom(tEvents)
        .where(tEvents.eventId.in(request.events.map(event => event.id)))
        .select({
            name: tEvents.eventShortName,
            startTime: tEvents.eventStartTime,
            endTime: tEvents.eventEndTime,
            location: tEvents.eventLocation,
        })
        .executeSelectMany();

    if (!events.length)
        notFound();

    const knowledge = [];
    for (const event of events) {
        const start = formatDate(event.startTime, 'YYYY-MM-DD');
        const end = formatDate(event.endTime, 'YYYY-MM-DD');

        knowledge.push(`${event.name} is hosted from ${start} to ${end} in ${event.location}.`);
    }

    // ---------------------------------------------------------------------------------------------

    const prompt = await readSetting('gen-ai-prompt-financial-insights');
    if (!prompt)
        notFound();

    const completedPrompt =
        prompt.replaceAll('{today}', formatDate(Temporal.Now.plainDateISO(), 'YYYY-MM-DD'));

    const series = await getTicketSalesComparisonSeries(request.events);
    const attachment = seriesToCsv(series);

    // ---------------------------------------------------------------------------------------------

    const client = await createVertexAIClient();
    const response = await client.predictText({
        prompt: `${completedPrompt}\n\n${knowledge.join('\n')}`,
        attachment,
    });

    return { success: true, insights: response };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    return executeAction(request, kFinancialInsightsDefinition, financialInsights);
}
