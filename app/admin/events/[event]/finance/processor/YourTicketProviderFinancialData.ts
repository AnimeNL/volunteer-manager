// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ProviderProduct, ProviderSale } from './Types';
import db, { tActivities, tEventsTicketsConfiguration, tYourTicketProviderPurchases,
    tYourTicketProviderTickets } from '@lib/database';

/**
 * Returns whether any valid, paid sales have been imported from YourTicketProvider for the given
 * `ytpEventId`.
 */
export async function hasYourTicketProviderSales(ytpEventId: number): Promise<boolean> {
    const sales = await db.selectFrom(tYourTicketProviderPurchases)
        .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(ytpEventId))
            .and(tYourTicketProviderPurchases.ytpPurchaseDateCancelled.isNull())
            .and(tYourTicketProviderPurchases.ytpPurchaseDatePaid.isNotNull())
        .selectCountAll()
        .executeSelectOne();

    return sales > 0;
}

/**
 * Fetches all categorised products and their daily sale counts from YourTicketProvider for the
 * given `eventId` and `ytpEventId`.
 */
export async function fetchYourTicketProviderProducts(eventId: number, ytpEventId: number)
    : Promise<ProviderProduct[]>
{
    const dbInstance = db;

    const activitiesJoin = tActivities.forUseInLeftJoin();

    const products = await dbInstance.selectFrom(tEventsTicketsConfiguration)
        .innerJoin(tYourTicketProviderTickets)
            .on(tYourTicketProviderTickets.ytpTicketEventId.equals(ytpEventId))
                .and(tYourTicketProviderTickets.ytpTicketId.equals(
                    tEventsTicketsConfiguration.eventTicketYtpId))
        .leftJoin(activitiesJoin)
            .on(activitiesJoin.activityId.equals(
                tEventsTicketsConfiguration.eventTicketActivityId))
        .where(tEventsTicketsConfiguration.eventId.equals(eventId))
            .and(tEventsTicketsConfiguration.eventTicketCategory.isNotNull())
        .select({
            id: tEventsTicketsConfiguration.eventTicketId,
            ytpTicketId: tYourTicketProviderTickets.ytpTicketId,
            category: tEventsTicketsConfiguration.eventTicketCategory,
            limit: tYourTicketProviderTickets.ytpTicketAmount.asOptional(),
            price: tYourTicketProviderTickets.ytpTicketPrice.divide(100),
            product: tYourTicketProviderTickets.ytpTicketName,
            program: {
                id: tEventsTicketsConfiguration.eventTicketActivityId,
                title: activitiesJoin.activityTitle,
            },
        })
        .executeSelectMany();

    if (!products.length)
        return [];

    const ytpTicketIds = products.map(product => product.ytpTicketId);

    const salesRows = await dbInstance.selectFrom(tYourTicketProviderPurchases)
        .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(ytpEventId))
            .and(tYourTicketProviderPurchases.ytpPurchaseItemTicketId.in(ytpTicketIds))
            .and(tYourTicketProviderPurchases.ytpPurchaseDateCancelled.isNull())
            .and(tYourTicketProviderPurchases.ytpPurchaseDatePaid.isNotNull())
        .select({
            ytpTicketId: tYourTicketProviderPurchases.ytpPurchaseItemTicketId,
            date: dbInstance.dateTimeAsDateString(
                tYourTicketProviderPurchases.ytpPurchaseDatePaid),
            complimentary:
                tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(/* true= */ 1),
            count: dbInstance.countAll(),
        })
        .groupBy('ytpTicketId', 'date', 'complimentary')
        .executeSelectMany();

    const salesByTicketId = new Map<number, ProviderSale[]>();
    for (const row of salesRows) {
        if (!row.date)
            continue;

        let bucket = salesByTicketId.get(row.ytpTicketId);
        if (!bucket) {
            bucket = [];
            salesByTicketId.set(row.ytpTicketId, bucket);
        }

        bucket.push({
            date: row.date,
            complimentary: row.complimentary,
            count: row.count,
        });
    }

    return products.map(product => ({
        id: product.id,
        category: product.category!,
        limit: product.limit,
        price: product.price,
        product: product.product,
        program: product.program ?? {},
        sales: salesByTicketId.get(product.ytpTicketId) ?? [],
    }));
}
