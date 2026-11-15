// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ProviderProduct, ProviderProductSales, ProviderSale } from '../Types';
import type { WeeztixTicketType } from '@lib/database/Types';
import { computeWeeztixTicketCapacity } from '@lib/integrations/weeztix';
import db, { tActivities, tEventsTicketsConfiguration, tWeeztixOrders, tWeeztixPurchases,
    tWeeztixTicketTypes, tWeeztixTickets } from '@lib/database';

import { kWeeztixTicketType } from '@lib/database/Types';

/**
 * Weeztix order statuses that represent settled, active orders eligible for financial reporting.
 */
const kSettledOrderStatuses = [ 'paid', 'swapped' ];

/**
 * Raw daily sale row returned by the Weeztix ticket and purchase queries.
 */
interface RawWeeztixSaleRow {
    typeGuid: string;
    date?: string;
    complimentary: boolean;
    count: number;
}

/**
 * Returns whether any valid, settled ticket or product sales have been imported from Weeztix for
 * the given `weeztixGuid`.
 */
export async function hasWeeztixSales(weeztixGuid: string): Promise<boolean> {
    const dbInstance = db;

    const ticketSales = await dbInstance.selectFrom(tWeeztixTickets)
        .innerJoin(tWeeztixOrders)
            .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixTickets.weeztixOrderGuid))
        .where(tWeeztixTickets.weeztixEventGuid.equals(weeztixGuid))
            .and(tWeeztixTickets.weeztixTicketDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderStatus.in(kSettledOrderStatuses))
        .selectCountAll()
        .executeSelectOne();

    if (ticketSales > 0)
        return true;

    const parentTicketsJoin = tWeeztixTickets.forUseInLeftJoin();

    const purchaseSales = await dbInstance.selectFrom(tWeeztixPurchases)
        .innerJoin(tWeeztixOrders)
            .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixPurchases.weeztixOrderGuid))
        .leftJoin(parentTicketsJoin)
            .on(parentTicketsJoin.weeztixGuid.equals(tWeeztixPurchases.weeztixTicketGuid))
        .where(tWeeztixPurchases.weeztixEventGuid.equals(weeztixGuid))
            .and(tWeeztixPurchases.weeztixPurchaseDeleted.isNull())
            .and(parentTicketsJoin.weeztixTicketDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderStatus.in(kSettledOrderStatuses))
        .selectCountAll()
        .executeSelectOne();

    return purchaseSales > 0;
}

/**
 * Fetches all categorised ticket and product types together with their daily sale counts from
 * Weeztix for the given `eventId` and `weeztixGuid`.
 */
export async function fetchWeeztixProducts(eventId: number, weeztixGuid: string)
    : Promise<ProviderProduct[]>
{
    const dbInstance = db;

    const activitiesJoin = tActivities.forUseInLeftJoin();

    const products = await dbInstance.selectFrom(tEventsTicketsConfiguration)
        .innerJoin(tWeeztixTicketTypes)
            .on(tWeeztixTicketTypes.weeztixEventGuid.equals(weeztixGuid))
                .and(tWeeztixTicketTypes.weeztixGuid.equals(
                    tEventsTicketsConfiguration.eventTicketWeeztixGuid))
        .leftJoin(activitiesJoin)
            .on(activitiesJoin.activityId.equals(
                tEventsTicketsConfiguration.eventTicketActivityId))
        .where(tEventsTicketsConfiguration.eventId.equals(eventId))
            .and(tEventsTicketsConfiguration.eventTicketWeeztixGuid.isNotNull())
            .and(tEventsTicketsConfiguration.eventTicketCategory.isNotNull())
        .select({
            id: tEventsTicketsConfiguration.eventTicketId,
            typeGuid: tWeeztixTicketTypes.weeztixGuid,
            type: tWeeztixTicketTypes.weeztixTicketType,
            category: tEventsTicketsConfiguration.eventTicketCategory,
            available: tWeeztixTicketTypes.weeztixTicketAvailable,
            sold: tWeeztixTicketTypes.weeztixTicketSold,
            status: tWeeztixTicketTypes.weeztixTicketStatus,
            price: tWeeztixTicketTypes.weeztixTicketPrice.divide(100),
            product: tWeeztixTicketTypes.weeztixTicketName,
            program: {
                id: tEventsTicketsConfiguration.eventTicketActivityId,
                title: activitiesJoin.activityTitle,
            },
        })
        .executeSelectMany();

    if (!products.length)
        return [];

    const salesByTypeGuid = await fetchWeeztixSalesByTypeGuid(weeztixGuid, products);

    return products.map(product => ({
        id: product.id,
        category: product.category!,
        limit: computeWeeztixTicketCapacity(product.available, product.sold, product.status),
        price: product.price,
        product: product.product,
        program: product.program ?? {},
        sales: salesByTypeGuid.get(product.typeGuid) ?? [],
    }));
}

/**
 * Fetches daily sale counts for the requested `productIds` from Weeztix for the given `eventId` and
 * `weeztixGuid`.
 */
export async function fetchWeeztixProductSales(
    eventId: number, weeztixGuid: string, productIds: number[]): Promise<ProviderProductSales[]>
{
    if (!productIds.length)
        return [];

    const products = await db.selectFrom(tEventsTicketsConfiguration)
        .innerJoin(tWeeztixTicketTypes)
            .on(tWeeztixTicketTypes.weeztixEventGuid.equals(weeztixGuid))
                .and(tWeeztixTicketTypes.weeztixGuid.equals(
                    tEventsTicketsConfiguration.eventTicketWeeztixGuid))
        .where(tEventsTicketsConfiguration.eventId.equals(eventId))
            .and(tEventsTicketsConfiguration.eventTicketWeeztixGuid.isNotNull())
            .and(tEventsTicketsConfiguration.eventTicketId.in(productIds))
        .select({
            id: tEventsTicketsConfiguration.eventTicketId,
            typeGuid: tWeeztixTicketTypes.weeztixGuid,
            type: tWeeztixTicketTypes.weeztixTicketType,
            available: tWeeztixTicketTypes.weeztixTicketAvailable,
            sold: tWeeztixTicketTypes.weeztixTicketSold,
            status: tWeeztixTicketTypes.weeztixTicketStatus,
            product: tWeeztixTicketTypes.weeztixTicketName,
        })
        .executeSelectMany();

    if (!products.length)
        return [];

    const salesByTypeGuid = await fetchWeeztixSalesByTypeGuid(weeztixGuid, products);

    return products.map(product => ({
        id: product.id,
        limit: computeWeeztixTicketCapacity(product.available, product.sold, product.status),
        product: product.product,
        sales: salesByTypeGuid.get(product.typeGuid) ?? [],
    }));
}

/**
 * Fetches and groups daily ticket and product sales by Weeztix type GUID.
 */
async function fetchWeeztixSalesByTypeGuid(
    weeztixGuid: string,
    products: { typeGuid: string; type: WeeztixTicketType }[]): Promise<Map<string, ProviderSale[]>>
{
    const ticketTypeGuids = products
        .filter(product => product.type === kWeeztixTicketType.Ticket)
        .map(product => product.typeGuid);

    const productTypeGuids = products
        .filter(product => product.type === kWeeztixTicketType.Product)
        .map(product => product.typeGuid);

    const ticketSales = await fetchWeeztixTicketSales(weeztixGuid, ticketTypeGuids);
    const purchaseSales = await fetchWeeztixPurchaseSales(weeztixGuid, productTypeGuids);

    const salesByTypeGuid = new Map<string, ProviderSale[]>();
    for (const row of [ ...ticketSales, ...purchaseSales ]) {
        if (!row.date)
            continue;

        let bucket = salesByTypeGuid.get(row.typeGuid);
        if (!bucket) {
            bucket = [];
            salesByTypeGuid.set(row.typeGuid, bucket);
        }

        bucket.push({
            date: row.date,
            complimentary: row.complimentary,
            count: row.count,
        });
    }

    return salesByTypeGuid;
}

/**
 * Fetches daily sale counts for configured Weeztix ticket types (`kWeeztixTicketType.Ticket`).
 */
async function fetchWeeztixTicketSales(weeztixGuid: string, typeGuids: string[])
    : Promise<RawWeeztixSaleRow[]>
{
    if (!typeGuids.length)
        return [];

    const dbInstance = db;

    return dbInstance.selectFrom(tWeeztixTickets)
        .innerJoin(tWeeztixOrders)
            .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixTickets.weeztixOrderGuid))
        .where(tWeeztixTickets.weeztixEventGuid.equals(weeztixGuid))
            .and(tWeeztixTickets.weeztixTicketTypeGuid.in(typeGuids))
            .and(tWeeztixTickets.weeztixTicketDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderStatus.in(kSettledOrderStatuses))
        .select({
            typeGuid: tWeeztixTickets.weeztixTicketTypeGuid,
            date: dbInstance.dateTimeAsDateString(tWeeztixTickets.weeztixTicketCreated),
            complimentary: tWeeztixTickets.weeztixTicketPrice.equals(0),
            count: dbInstance.countAll(),
        })
        .groupBy('typeGuid', 'date', 'complimentary')
        .executeSelectMany();
}

/**
 * Fetches daily sale counts for configured Weeztix add-on and standalone product types
 * (`kWeeztixTicketType.Product`).
 */
async function fetchWeeztixPurchaseSales(weeztixGuid: string, typeGuids: string[])
    : Promise<RawWeeztixSaleRow[]>
{
    if (!typeGuids.length)
        return [];

    const dbInstance = db;
    const parentTicketsJoin = tWeeztixTickets.forUseInLeftJoin();

    return dbInstance.selectFrom(tWeeztixPurchases)
        .innerJoin(tWeeztixOrders)
            .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixPurchases.weeztixOrderGuid))
        .leftJoin(parentTicketsJoin)
            .on(parentTicketsJoin.weeztixGuid.equals(tWeeztixPurchases.weeztixTicketGuid))
        .where(tWeeztixPurchases.weeztixEventGuid.equals(weeztixGuid))
            .and(tWeeztixPurchases.weeztixPurchaseTypeGuid.in(typeGuids))
            .and(tWeeztixPurchases.weeztixPurchaseDeleted.isNull())
            .and(parentTicketsJoin.weeztixTicketDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderStatus.in(kSettledOrderStatuses))
        .select({
            typeGuid: tWeeztixPurchases.weeztixPurchaseTypeGuid,
            date: dbInstance.dateTimeAsDateString(tWeeztixPurchases.weeztixPurchaseCreated),
            complimentary: tWeeztixPurchases.weeztixPurchasePrice.equals(0),
            count: dbInstance.countAll(),
        })
        .groupBy('typeGuid', 'date', 'complimentary')
        .executeSelectMany();
}
