// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import type { BarSeriesType, ChartsReferenceLineProps, LineSeriesType } from '@mui/x-charts-pro';

import { type RemoteGraphFnReturn, computeTickInterval } from './RemoteGraphFn';
import { Temporal, isAfter, isBefore } from '@lib/Temporal';
import { executeServerAction } from '@lib/serverAction';
import { readSetting } from '@lib/Settings';
import db, { tEvents, tEventsSales, tEventsSalesConfiguration } from '@lib/database';

import { kRemoteGraphColorScheme, kRemoteGraphLimitColour } from './RemoteGraphFn';

/**
 * Maximum space (as a fraction of 1) that is allowed to be wasted in favour of displaying the
 * product sales limit information.
 */
const kMaximumWastedVerticalSpace = 0.4;

/**
 * Server action used to fetch product sales information for the given |products|, associated with
 * the given |eventId|. Called when the chart is being requested by the client. Will complete the
 * necessary security checks, specifically to verify access to financial statistic.s
 */
export async function fetchProductSales(eventId: number, products: number[]) {
    return executeServerAction(new FormData, z.object(), async (data: unknown, props) => {
        if (!props.access.can('statistics.finances'))
            return { success: false, error: 'No access to sales information…' };

        return actuallyFetchProductSales(eventId, products);
    });
}

/**
 * Actually fetches product sales information for the given |eventId| and |products|.
 */
async function actuallyFetchProductSales(eventId: number, products: number[])
    : Promise<RemoteGraphFnReturn>
{
    if (products.length > kRemoteGraphColorScheme.length)
        throw new Error('Not enough colours defined to deal with this many products...');

    const currentDate = Temporal.Now.plainDateISO();

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Determine the date range for this sales graph. This is relative to either the festival's
    // dates, or to the product category's availability dates, depending on a settings.
    // ---------------------------------------------------------------------------------------------

    const useProductRelativeDateRange = !await readSetting('program-event-sales-relative');
    const dateRange = await dbInstance.selectFrom(tEventsSales)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tEventsSales.eventId))
        .where(tEventsSales.eventId.equals(eventId))
            .and(tEventsSales.eventSaleId.in(products).onlyWhen(useProductRelativeDateRange))
            .and(tEventsSales.eventSaleCount.greaterThan(0))
        .select({
            min: dbInstance.min(tEventsSales.eventSaleDate),
            max: tEvents.eventEndTime,
        })
        .executeSelectNoneOrOne();

    if (!dateRange)
        return { success: false, error: 'Unable to determine the date range for this graph…' };
    if (!dateRange.min)
        return { success: false, error: 'Unable to determine the minimum date for this graph…' };

    const maxPlainDate = dateRange.max.toPlainDate();

    const min = dateRange.min;
    const max = isBefore(currentDate, maxPlainDate) ? currentDate : maxPlainDate;

    // ---------------------------------------------------------------------------------------------
    // Prepare the base information.
    // ---------------------------------------------------------------------------------------------

    // The bar graphs that should be shown on the graph, populated for each product.
    const bars: Map<number, BarSeriesType & { data: (number | null)[] }> = new Map();

    // The maximum limit for each individual product series.
    let limitMaximum: number = 0;

    // The maximum number of products that can be sold. Key is the limit, value are the product(s).
    const limits: Map<number, string[]> = new Map();

    // The line graphs that should be shown on the graph, populated for each product.
    const lines: Map<number, LineSeriesType & { data: (number | null)[] }> = new Map();

    // The sales information representing day-by-day sales, populated for each product.
    const sales: Map<number, Map<string, number>> = new Map();

    // ---------------------------------------------------------------------------------------------
    // Fetch the sales information from the database and populate the
    // ---------------------------------------------------------------------------------------------

    const eventsSalesJoin = tEventsSales.forUseInLeftJoin();
    const eventsSalesData = await dbInstance.selectFrom(tEventsSalesConfiguration)
        .leftJoin(eventsSalesJoin)
            .on(eventsSalesJoin.eventSaleId.equals(tEventsSalesConfiguration.saleId))
        .where(tEventsSalesConfiguration.saleId.in(products))
        .select({
            id: tEventsSalesConfiguration.saleId,
            product: tEventsSalesConfiguration.saleProduct,
            limit: tEventsSalesConfiguration.saleCategoryLimit,
            sales: dbInstance.aggregateAsArray({
                date: dbInstance.dateAsString(eventsSalesJoin.eventSaleDate),
                count: eventsSalesJoin.eventSaleCount,
            }),
        })
        .groupBy(tEventsSalesConfiguration.saleId)
        .executeSelectMany();

    let productIndex = 0;
    for (const data of eventsSalesData) {
        if (typeof data.limit === 'number') {
            limits.set(data.limit, [ ...(limits.get(data.limit) || []), data.product ]);
            limitMaximum = Math.max(limitMaximum, data.limit);
        }

        if (!sales.has(data.id))
            sales.set(data.id, new Map);

        bars.set(data.id, {
            type: 'bar',
            color: `${kRemoteGraphColorScheme[productIndex]}80`,
            label: data.product,
            data: [ /* to be populated */ ],
            stack: 'day',
        });

        lines.set(data.id, {
            type: 'line',
            color: kRemoteGraphColorScheme[productIndex],
            label: data.product,
            data: [ /* to be populated */ ],
        });

        const productSales = sales.get(data.id)!;
        for (const { date, count } of data.sales)
            productSales.set(date, count);

        productIndex++;
    }

    // ---------------------------------------------------------------------------------------------
    // Determine the reference lines, i.e. the sales limits. One line with just the limit will be
    // shown when the limit is known and there's only a single limit, otherwise multiple lines will
    // be created. This can happen when e.g. tickets for one of three tastings have been reserved.
    // ---------------------------------------------------------------------------------------------

    const referenceLines: ChartsReferenceLineProps[] = [ ...limits.entries() ].map(([ y, p ]) => ({
        label: limits.size === 1 ? `${y}` : `${y} (${p.join(', ')})`,
        labelStyle: {
            fill: kRemoteGraphLimitColour,
            fontSize: '12px',
        },
        lineStyle: {
            strokeDasharray: 4,
            stroke: kRemoteGraphLimitColour
        },
        y,
    }));

    // ---------------------------------------------------------------------------------------------
    // Compute the per-day and sales aggregates and add the resulting information to both the per-
    // day bar charts, and the aggregate line charts, for each of the products in the graph.
    // ---------------------------------------------------------------------------------------------

    const aggregates: Map<number, number> = new Map();
    const labels: string[] = [ /* no labels yet */ ];

    // Maximum number of products that have been sold from any individual category.
    let productSalesMaximum: number = 0;

    for (let date = min; !isAfter(date, max); date = date.add({ days: 1 })) {
        const dateString = date.toString();

        for (const [ product, productSales ] of sales.entries()) {
            const salesAggregate = aggregates.get(product) || 0;
            const salesForDate = productSales.get(dateString) || 0;

            const totalSales = salesAggregate + salesForDate;

            bars.get(product!)?.data.push(salesForDate > 0 ? salesForDate : null);
            lines.get(product)!.data.push(totalSales > 0 ? totalSales : null);

            aggregates.set(product, totalSales);

            productSalesMaximum = Math.max(productSalesMaximum, totalSales);
        }

        labels.push(dateString);
    }

    // ---------------------------------------------------------------------------------------------
    // Decide on the maximum value to display on the vertical axis (y). Generally prefer the highest
    // product sales limit, when known, but ignore this when it would lead a substantial amount of
    // vertical space being unused.
    // ---------------------------------------------------------------------------------------------

    let verticalAxisMaximum: number | undefined;
    if (limitMaximum > 0 && (limitMaximum * kMaximumWastedVerticalSpace) <= productSalesMaximum) {
        verticalAxisMaximum = Math.floor(limitMaximum * 1.1);
    }

    // ---------------------------------------------------------------------------------------------

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
                tickInterval: computeTickInterval(labels, /* amount= */ 6),
                tickLabelPlacement: 'tick',
                tickPlacement: 'middle',
                zoom: true,
            },
            yAxis: [
                {
                    position: 'left',
                    max: verticalAxisMaximum,
                    width: 50,
                },
            ],
        },
    };
}
