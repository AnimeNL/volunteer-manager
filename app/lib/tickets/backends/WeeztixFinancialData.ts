// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FinancialFilter, FinancialFilterOptions, ProviderProduct, ProviderProductSales,
    ProviderSale } from '../Types';
import type { WeeztixTicketType } from '@lib/database/Types';
import { computeWeeztixTicketCapacity } from '@lib/integrations/weeztix';
import { groupSalesByKey } from '../TicketHelpers';
import db, { tActivities, tEventsTicketsConfiguration, tWeeztixOrders, tWeeztixPurchases,
    tWeeztixTicketTypes, tWeeztixTickets } from '@lib/database';

import { kWeeztixTicketType } from '@lib/database/Types';

/**
 * Weeztix order statuses that represent settled, active orders eligible for financial reporting.
 */
export const kWeeztixSettledOrderStatuses = [ 'paid', 'swapped' ];

/**
 * Test UTM filter values that should be excluded from discovered financial filter options.
 */
const kIgnoredUtmFilterValues = new Set([ 'peter', 'peter2', 'peter3' ]);

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
            .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
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
            .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
        .selectCountAll()
        .executeSelectOne();

    return purchaseSales > 0;
}

/**
 * Fetches distinct UTM source and campaign values from settled Weeztix orders for `weeztixGuid`.
 */
export async function fetchWeeztixFinancialFilterOptions(weeztixGuid: string)
    : Promise<FinancialFilterOptions>
{
    const dbInstance = db;

    const rows = await dbInstance.selectFrom(tWeeztixOrders)
        .where(tWeeztixOrders.weeztixEventGuid.equals(weeztixGuid))
            .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
            .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
        .select({
            utmSource: tWeeztixOrders.weeztixOrderUtmSource,
            utmCampaign: tWeeztixOrders.weeztixOrderUtmCampaign,
        })
        .groupBy('utmSource', 'utmCampaign')
        .executeSelectMany();

    const utmSources = new Set<string>();
    const utmCampaigns = new Set<string>();

    for (const row of rows) {
        if (row.utmSource && !kIgnoredUtmFilterValues.has(row.utmSource.toLowerCase()))
            utmSources.add(row.utmSource);
        if (row.utmCampaign && !kIgnoredUtmFilterValues.has(row.utmCampaign.toLowerCase()))
            utmCampaigns.add(row.utmCampaign);
    }

    return {
        utmSources: [ ...utmSources ].sort(),
        utmCampaigns: [ ...utmCampaigns ].sort(),
    };
}

/**
 * Fetches all categorised ticket and product types together with their daily sale counts from
 * Weeztix for the given `eventId` and `weeztixGuid`, optionally filtered by `filter`.
 */
export async function fetchWeeztixProducts(
    eventId: number, weeztixGuid: string, filter?: FinancialFilter): Promise<ProviderProduct[]>
{
    const products = await queryWeeztixProducts(eventId, weeztixGuid, undefined, filter);
    return products.map(product => ({
        ...product,
        category: product.category!,
    }));
}

/**
 * Fetches daily sale counts for the requested `productIds` from Weeztix for the given `eventId` and
 * `weeztixGuid`, optionally filtered by `filter`.
 */
export async function fetchWeeztixProductSales(
    eventId: number, weeztixGuid: string, productIds: number[], filter?: FinancialFilter)
        : Promise<ProviderProductSales[]>
{
    if (!productIds.length)
        return [];

    const products = await queryWeeztixProducts(eventId, weeztixGuid, productIds, filter);
    return products.map(({ id, limit, product, sales }) => ({
        id,
        limit,
        product,
        sales,
    }));
}

/**
 * Shared query helper for fetching configured Weeztix products and their daily sale counts,
 * optionally filtered to specific `productIds` (otherwise requiring an assigned category) and
 * `filter`.
 */
async function queryWeeztixProducts(
    eventId: number, weeztixGuid: string, productIds?: number[], filter?: FinancialFilter)
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
            .and(productIds !== undefined
                ? tEventsTicketsConfiguration.eventTicketId.in(productIds)
                : tEventsTicketsConfiguration.eventTicketCategory.isNotNull())
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

    const salesByTypeGuid = await fetchWeeztixSalesByTypeGuid(weeztixGuid, products, filter);

    return products.map(product => ({
        id: product.id,
        category: product.category,
        limit: computeWeeztixTicketCapacity(product.available, product.sold, product.status),
        price: product.price,
        product: product.product,
        program: product.program ?? {},
        sales: salesByTypeGuid.get(product.typeGuid) ?? [],
    }));
}

/**
 * Fetches and groups daily ticket and product sales by Weeztix type GUID.
 */
async function fetchWeeztixSalesByTypeGuid(
    weeztixGuid: string,
    products: { typeGuid: string; type: WeeztixTicketType }[],
    filter?: FinancialFilter): Promise<Map<string, ProviderSale[]>>
{
    const ticketTypeGuids = products
        .filter(product => product.type === kWeeztixTicketType.Ticket)
        .map(product => product.typeGuid);

    const productTypeGuids = products
        .filter(product => product.type === kWeeztixTicketType.Product)
        .map(product => product.typeGuid);

    const ticketSales = await fetchWeeztixTicketSales(weeztixGuid, ticketTypeGuids, filter);
    const purchaseSales = await fetchWeeztixPurchaseSales(weeztixGuid, productTypeGuids, filter);

    return groupSalesByKey([ ...ticketSales, ...purchaseSales ], row => row.typeGuid);
}

/**
 * Fetches daily sale counts for configured Weeztix ticket types (`kWeeztixTicketType.Ticket`).
 */
async function fetchWeeztixTicketSales(
    weeztixGuid: string, typeGuids: string[], filter?: FinancialFilter)
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
            .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
            .and(tWeeztixOrders.weeztixOrderUtmSource.equalsIfValue(filter?.utmSource || undefined))
            .and(tWeeztixOrders.weeztixOrderUtmCampaign.equalsIfValue(
                filter?.utmCampaign || undefined))
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
async function fetchWeeztixPurchaseSales(
    weeztixGuid: string, typeGuids: string[], filter?: FinancialFilter)
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
            .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
            .and(tWeeztixOrders.weeztixOrderUtmSource.equalsIfValue(filter?.utmSource || undefined))
            .and(tWeeztixOrders.weeztixOrderUtmCampaign.equalsIfValue(
                filter?.utmCampaign || undefined))
        .select({
            typeGuid: tWeeztixPurchases.weeztixPurchaseTypeGuid,
            date: dbInstance.dateTimeAsDateString(tWeeztixPurchases.weeztixPurchaseCreated),
            complimentary: tWeeztixPurchases.weeztixPurchasePrice.equals(0),
            count: dbInstance.countAll(),
        })
        .groupBy('typeGuid', 'date', 'complimentary')
        .executeSelectMany();
}
