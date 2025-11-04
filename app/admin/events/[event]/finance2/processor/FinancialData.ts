// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventSalesCategory } from '@lib/database/Types';
import { Temporal } from '@lib/Temporal';
import db, { tActivities, tEvents, tEventsSales, tEventsSalesConfiguration } from '@lib/database';

/**
 * Interface defining the raw representation of finaicial data associated with a specific event.
 */
interface FinancialEventData {
    /**
     * Unique ID identifying this event.
     */
    id: number;

    /**
     * URL-safe slug identifying this event.
     */
    slug: string;

    /**
     * Short name that can be used to help refer to the event.
     */
    shortName: string;

    /**
     * Time and date, in UTC, at which the event will finish.
     */
    startTime: Temporal.ZonedDateTime;

    /**
     * Time and date, in UTC, at which the event will finish.
     */
    endTime: Temporal.ZonedDateTime;

    /**
     * Sale products that exist for this event. Keyed by the products's unique ID.
     */
    products: Map<number, {
        /**
         * Unique ID of this product as it exists in the database.
         */
        id: number;

        /**
         * Category of sale that this product belongs to.
         */
        category: EventSalesCategory;

        /**
         * Maximum number of products that can be sold.
         */
        limit?: number;

        /**
         * Price, in local currency, for which this product is being sold. Expected to remain fixed.
         */
        price?: number;

        /**
         * Name of the product that this object describes.
         */
        product: string;

        /**
         * Optional AnPlan program association that exists for this product.
         */
        program: {
            /**
             * Unique ID of the program entry, as it exists in AnPlan.
             */
            id?: number;

            /**
             * Title of the program, as it exists in AnPlan.
             */
            title?: string;
        };

        /**
         * Keyed by number of days until the event (365, 0], and valued with the number of products
         * that were sold on that very day.
         */
        sales: Map<number, number>;
    }>;
}

/**
 * Interface defining the raw representation of our financial data.
 */
export interface FinancialData {
    /**
     * Reference date that indicates the end of the financial coverage of this event.
     */
    referenceDate: Temporal.ZonedDateTime;

    /**
     * Number of days remaining for the financial coverage of this event.
     */
    remaining: number;

    /**
     * Financial information about the selected events. The first entry in this array always is the
     * event that is being highlighted, where the remaining entries contain historical data.
     */
    data: FinancialEventData[];
}

/**
 * Number of historic events that should be considered by the processor.
 */
const kHistoricEventCount = 3;

/**
 * Fetches financial data from the database for the given `eventSlug`, as well as a number of
 * historic events defined in the `kHistoricEventCount` constant. Returns `undefined` when the
 * `eventSlug` has no financial information associated with it (yet).
 */
export async function fetchFinancialData(eventSlug: string): Promise<FinancialData | undefined> {
    const dbInstance = db;

    const eventValidation = await dbInstance.selectFrom(tEvents)
        .innerJoin(tEventsSales)
            .on(tEventsSales.eventId.equals(tEvents.eventId))
        .where(tEvents.eventSlug.equals(eventSlug))
        .select({
            endTime: tEvents.eventEndTime.asOptional(),
            sales: dbInstance.count(tEventsSales.eventSaleDate),
        })
        .executeSelectNoneOrOne();

    if (!eventValidation || !eventValidation.endTime || eventValidation.sales === 0)
        return undefined;  // invalid |event|, or it has no sales data attached

    // ---------------------------------------------------------------------------------------------

    const events = await dbInstance.selectFrom(tEvents)
        .innerJoin(tEventsSalesConfiguration)
            .on(tEventsSalesConfiguration.eventId.equals(tEvents.eventId))
                .and(tEventsSalesConfiguration.saleCategory.isNotNull())
        .where(tEvents.eventEndTime.lessOrEquals(eventValidation.endTime))
        .select({
            id: tEvents.eventId,

            startTime: tEvents.eventStartTime,
            endTime: tEvents.eventEndTime,

            shortName: tEvents.eventShortName,
            slug: tEvents.eventSlug,

            products: dbInstance.aggregateAsArrayOfOneColumn(tEventsSalesConfiguration.saleId),
        })
        .groupBy(tEvents.eventId)
        .orderBy(tEvents.eventEndTime, 'desc')
        .limit(kHistoricEventCount + 1)
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    const activitiesJoin = tActivities.forUseInLeftJoin();
    const daysFromEvent = dbInstance.fragmentWithType('int', 'required')
        .sql`DATEDIFF(${tEvents.eventEndTime}, ${tEventsSales.eventSaleDate})`;

    const products = await dbInstance.selectFrom(tEventsSalesConfiguration)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tEventsSalesConfiguration.eventId))
        .innerJoin(tEventsSales)
            .on(tEventsSales.eventSaleId.equals(tEventsSalesConfiguration.saleId))
        .leftJoin(activitiesJoin)
            .on(activitiesJoin.activityId.equals(tEventsSalesConfiguration.saleEventId))
        .where(tEventsSalesConfiguration.eventId.in(events.map(event => event.id)))
            .and(tEventsSalesConfiguration.saleCategory.isNotNull())
        .select({
            id: tEventsSalesConfiguration.saleId,

            category: tEventsSalesConfiguration.saleCategory,
            limit: tEventsSalesConfiguration.saleCategoryLimit,
            price: tEventsSalesConfiguration.salePrice,
            product: tEventsSalesConfiguration.saleProduct,
            program: {
                id: tEventsSalesConfiguration.saleEventId,
                title: activitiesJoin.activityTitle,
            },

            sales: dbInstance.aggregateAsArray({
                days: daysFromEvent,
                count: tEventsSales.eventSaleCount,
            }),
        })
        .groupBy(tEventsSalesConfiguration.saleId)
        .executeSelectMany();

    // Transforms the |products| array into a map for faster lookup:
    const productsMap = new Map(products.map(products => ([ products.id, products ])));

    // ---------------------------------------------------------------------------------------------

    const financialEventData: FinancialEventData[] = [];
    for (const event of events) {
        const products: FinancialEventData['products'] = new Map;

        for (const productId of event.products) {
            if (!productsMap.has(productId))
                throw new Error(`Invalid product found for event ${event.slug}: ${productId}`);

            const product = productsMap.get(productId)!;
            const sales: Map<number, number> = new Map;

            for (let days = 365; days <= 0; --days)
                sales.set(days, /* default value= */ 0);

            for (const { days, count } of product.sales) {
                const clampedDays = Math.max(0, Math.min(days, 365));
                sales.set(clampedDays, (sales.get(clampedDays) ?? 0) + count);
            }

            products.set(product.id, {
                ...product,
                category: product.category!,  // null check performed in the query
                program: product.program ?? { /* no program data */ },
                sales,
            });
        }

        financialEventData.push({
            ...event,
            products,
        });
    }

    // ---------------------------------------------------------------------------------------------

    const remaining = financialEventData[0].endTime.since(Temporal.Now.zonedDateTimeISO('utc'), {
        largestUnit: 'days',
    });

    return {
        referenceDate: financialEventData[0].endTime,
        remaining: Math.max(0, Math.min(remaining.days, 365)),
        data: financialEventData,
    };
}
