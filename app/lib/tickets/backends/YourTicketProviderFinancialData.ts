// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ProviderProduct, ProviderProductSales, ProviderSale } from '../Types';
import { groupSalesByKey } from '../TicketHelpers';
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
    const products = await queryYourTicketProviderProducts(eventId, ytpEventId);
    return products.map(product => ({
        ...product,
        category: product.category!,
    }));
}

/**
 * Fetches daily sale counts for the requested `productIds` from YourTicketProvider for the given
 * `eventId` and `ytpEventId`.
 */
export async function fetchYourTicketProviderProductSales(
    eventId: number, ytpEventId: number, productIds: number[]): Promise<ProviderProductSales[]>
{
    if (!productIds.length)
        return [];

    const products = await queryYourTicketProviderProducts(eventId, ytpEventId, productIds);
    return products.map(({ id, limit, product, sales }) => ({
        id,
        limit,
        product,
        sales,
    }));
}

/**
 * Shared query helper for fetching configured YourTicketProvider products and their daily sale
 * counts, optionally filtered to specific `productIds` (otherwise requiring an assigned category).
 */
async function queryYourTicketProviderProducts(
    eventId: number, ytpEventId: number, productIds?: number[])
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
            .and(tEventsTicketsConfiguration.eventTicketYtpId.isNotNull())
            .and(productIds !== undefined
                ? tEventsTicketsConfiguration.eventTicketId.in(productIds)
                : tEventsTicketsConfiguration.eventTicketCategory.isNotNull())
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
    const salesByTicketId = await fetchYourTicketProviderSalesByTicketId(ytpEventId, ytpTicketIds);

    return products.map(product => ({
        id: product.id,
        category: product.category,
        limit: product.limit,
        price: product.price,
        product: product.product,
        program: product.program ?? {},
        sales: salesByTicketId.get(product.ytpTicketId) ?? [],
    }));
}

/**
 * Fetches and groups daily YourTicketProvider sales by ticket ID.
 */
async function fetchYourTicketProviderSalesByTicketId(ytpEventId: number, ytpTicketIds: number[])
    : Promise<Map<number, ProviderSale[]>>
{
    const dbInstance = db;

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

    return groupSalesByKey(salesRows, row => row.ytpTicketId);
}
