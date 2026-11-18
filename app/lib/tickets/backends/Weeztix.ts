// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory, EventTicketProvider } from '@lib/database/Types';
import type { FinancialFilter, FinancialFilterOptions, ProviderProduct, ProviderProductSales,
    Purchase, Ticket, TicketConfiguration, TicketCreateRequest, TicketFinancialSummary,
    TicketSearchRequest, TicketSearchResults, TicketStatistics, TicketType, VolunteerTicket }
    from '../Types';
import type { TicketService } from '../TicketService';
import { computeWeeztixTicketCapacity } from '@lib/integrations/weeztix';
import { fetchWeeztixFinancialFilterOptions, fetchWeeztixProductSales, fetchWeeztixProducts,
    hasWeeztixSales, kWeeztixSettledOrderStatuses } from './WeeztixFinancialData';
import { kTicketSearchSortFieldMap, listTicketConfigurationsByProvider,
    upsertTicketConfigurationByProvider } from '../TicketHelpers';
import db, { tEventsTicketsConfiguration, tUsersEventsTickets, tWeeztixOrders, tWeeztixPurchases,
    tWeeztixTicketTypes, tWeeztixTickets } from '@lib/database';

import { kWeeztixTicketType } from '@lib/database/Types';

/**
 * Normalised row projected from either `weeztix_tickets` or `weeztix_purchases` joined with its
 * owning `weeztix_orders` record (and parent `weeztix_tickets` record when applicable).
 */
interface RawTicketRow {
    id: string;
    purchaseId: string;
    ticketId: string;
    barcode?: string;
    name?: string;
    nickname?: string;
    function?: string;
    organisation?: string;
    parentTicketName?: string;
    price: number;
    created: Temporal.ZonedDateTime;
    deleted?: Temporal.ZonedDateTime;
    parentTicketDeleted?: Temporal.ZonedDateTime;
    orderName?: string;
    orderStatus: string;
    orderUpdated: Temporal.ZonedDateTime;
    orderDeleted?: Temporal.ZonedDateTime;
}

/**
 * Converts a `RawTicketRow` obtained from the database into a `Ticket` entry.
 */
function toTicket(row: RawTicketRow): Ticket {
    const holder = (row.name || row.parentTicketName || row.orderName)?.trim() || undefined;
    const nickname = row.nickname?.trim() || undefined;
    const func = row.function?.trim() || undefined;
    const organisation = row.organisation?.trim() || undefined;
    const paid = kWeeztixSettledOrderStatuses.includes(row.orderStatus) ? row.created : undefined;
    const cancelled =
        row.deleted ?? row.parentTicketDeleted ?? row.orderDeleted ??
        (row.orderStatus === 'cancelled' ? row.orderUpdated : undefined);

    return {
        id: row.id,
        purchaseId: row.purchaseId,
        ticketId: row.ticketId,
        barcode: row.barcode || undefined,
        holder,
        nickname,
        function: func,
        organisation,
        complimentary: row.price === 0,
        cancelled,
        paid,
    };
}

/**
 * Implementation of the `TicketService` specific to Weeztix.
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 */
export class Weeztix implements TicketService {
    #companyId: string | undefined;
    #eventId: string;
    #volunteerTicketGuid: string | undefined;

    constructor(eventId: string, companyId?: string, volunteerTicketGuid?: string) {
        this.#eventId = eventId;
        this.#companyId = companyId;
        this.#volunteerTicketGuid = volunteerTicketGuid;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketService implementation:
    // ---------------------------------------------------------------------------------------------

    get id(): EventTicketProvider { return 'Weeztix' };
    get eventId(): number | string { return this.#eventId; }

    async anonymizeTickets(): Promise<number> {
        return db.transaction(async () => {
            const ticketRows = await db.update(tWeeztixTickets)
                .set({
                    weeztixTicketName: '(anonymized)',
                    weeztixTicketMetaNickname: null,
                })
                .where(tWeeztixTickets.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixTickets.weeztixTicketPrice.greaterThan(0))
                    .and(tWeeztixTickets.weeztixTicketName.isNotNull().or(
                        tWeeztixTickets.weeztixTicketMetaNickname.isNotNull()))
                    .and(tWeeztixTickets.weeztixTicketName.isNull().or(
                        tWeeztixTickets.weeztixTicketName.notEquals('(anonymized)')))
                    .and(tWeeztixTickets.weeztixTicketMetaFunction.isNull())
                    .and(tWeeztixTickets.weeztixTicketMetaOrganisation.isNull())
                .executeUpdate();

            const purchaseRows = await db.update(tWeeztixPurchases)
                .set({
                    weeztixPurchaseName: '(anonymized)',
                })
                .where(tWeeztixPurchases.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixPurchases.weeztixPurchasePrice.greaterThan(0))
                    .and(tWeeztixPurchases.weeztixPurchaseName.isNotNull())
                    .and(tWeeztixPurchases.weeztixPurchaseName.notEquals('(anonymized)'))
                .executeUpdate();

            const orderRows = await db.update(tWeeztixOrders)
                .set({
                    weeztixOrderName: '(anonymized)',
                })
                .where(tWeeztixOrders.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixOrders.weeztixOrderName.isNotNull())
                    .and(tWeeztixOrders.weeztixOrderName.notEquals('(anonymized)'))
                .executeUpdate();

            return ticketRows + purchaseRows + orderRows;
        });
    }

    canCancelPurchases(): boolean {
        return false;
    }

    canCreateTickets(): boolean {
        return false;
    }

    canManageVolunteerTickets(): boolean {
        return !!this.#volunteerTicketGuid;
    }

    async cancelPurchase(purchaseId: number | string): Promise<void> {
        throw new Error('Not yet implemented');
    }

    createPurchaseLink(purchaseId: number | string): string | undefined {
        if (!this.#companyId)
            return undefined;

        const baseUrl = 'https://app.weeztix.com/orders';
        return `${baseUrl}/${purchaseId}?company=${this.#companyId}&classic=true`;
    }

    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        throw new Error('Not yet implemented');
    }

    async fetchFinancialFilterOptions(): Promise<FinancialFilterOptions> {
        return fetchWeeztixFinancialFilterOptions(this.#eventId);
    }

    async fetchFinancialProducts(eventId: number, filter?: FinancialFilter)
        : Promise<ProviderProduct[]>
    {
        return fetchWeeztixProducts(eventId, this.#eventId, filter);
    }

    async fetchProductSales(eventId: number, productIds: number[], filter?: FinancialFilter)
        : Promise<ProviderProductSales[]>
    {
        return fetchWeeztixProductSales(eventId, this.#eventId, productIds, filter);
    }

    async fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined> {
        const dbInstance = db;
        const orderGuid = String(purchaseId);

        const order = await dbInstance.selectFrom(tWeeztixOrders)
            .where(tWeeztixOrders.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixOrders.weeztixGuid.equals(orderGuid))
            .select({
                id: tWeeztixOrders.weeztixGuid,
                eventId: tWeeztixOrders.weeztixEventGuid,
                name: tWeeztixOrders.weeztixOrderName,
                status: tWeeztixOrders.weeztixOrderStatus,
                created: tWeeztixOrders.weeztixOrderCreated,
                updated: tWeeztixOrders.weeztixOrderUpdated,
                deleted: tWeeztixOrders.weeztixOrderDeleted,
            })
            .executeSelectNoneOrOne();

        if (!order)
            return undefined;

        const ticketTypesJoin = tWeeztixTicketTypes.forUseInLeftJoin();

        const ticketRows = await dbInstance.selectFrom(tWeeztixTickets)
            .leftJoin(ticketTypesJoin)
                .on(ticketTypesJoin.weeztixEventGuid.equals(this.#eventId))
                    .and(ticketTypesJoin.weeztixGuid.equals(
                        tWeeztixTickets.weeztixTicketTypeGuid))
            .where(tWeeztixTickets.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixTickets.weeztixOrderGuid.equals(orderGuid))
            .select({
                id: tWeeztixTickets.weeztixGuid,
                ticketId: tWeeztixTickets.weeztixTicketTypeGuid,
                ticketName: ticketTypesJoin.weeztixTicketName,
                barcode: tWeeztixTickets.weeztixTicketBarcode,
                name: tWeeztixTickets.weeztixTicketName,
                nickname: tWeeztixTickets.weeztixTicketMetaNickname,
            })
            .executeSelectMany();

        const parentTicketsJoin = tWeeztixTickets.forUseInLeftJoin();

        const purchaseRows = await dbInstance.selectFrom(tWeeztixPurchases)
            .innerJoin(tWeeztixTicketTypes)
                .on(tWeeztixTicketTypes.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixTicketTypes.weeztixGuid.equals(
                        tWeeztixPurchases.weeztixPurchaseTypeGuid))
                    .and(tWeeztixTicketTypes.weeztixTicketType.equals(kWeeztixTicketType.Product))
            .leftJoin(parentTicketsJoin)
                .on(parentTicketsJoin.weeztixGuid.equals(tWeeztixPurchases.weeztixTicketGuid))
            .where(tWeeztixPurchases.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixPurchases.weeztixOrderGuid.equals(orderGuid))
            .select({
                id: tWeeztixPurchases.weeztixGuid,
                ticketId: tWeeztixPurchases.weeztixPurchaseTypeGuid,
                ticketName: tWeeztixTicketTypes.weeztixTicketName,
                barcode: parentTicketsJoin.weeztixTicketBarcode,
                name: tWeeztixPurchases.weeztixPurchaseName,
                parentTicketName: parentTicketsJoin.weeztixTicketName,
            })
            .executeSelectMany();

        return {
            id: order.id,
            eventId: order.eventId,
            name: order.name?.trim() || undefined,
            cancelled: order.deleted ?? (order.status === 'cancelled' ? order.updated : undefined),
            paid: kWeeztixSettledOrderStatuses.includes(order.status) ? order.created : undefined,
            tickets: [
                ...ticketRows.map(row => ({
                    id: row.id,
                    ticketId: row.ticketId,
                    ticketName: row.ticketName?.trim() || undefined,
                    barcode: row.barcode || undefined,
                    holder: (row.name || order.name)?.trim() || undefined,
                    nickname: row.nickname?.trim() || undefined,
                })),
                ...purchaseRows.map(row => ({
                    id: row.id,
                    ticketId: row.ticketId,
                    ticketName: row.ticketName.trim() || undefined,
                    barcode: row.barcode || undefined,
                    holder: (row.name || row.parentTicketName || order.name)?.trim() || undefined,
                })),
            ],
        };
    }

    formatPurchaseId(purchaseId: number | string): string {
        return String(purchaseId).split('-')[0];
    }

    formatTicketId(ticketId: number | string): string {
        return String(ticketId).split('-')[0];
    }

    async getFinancialSummary(eventId: number): Promise<TicketFinancialSummary> {
        const dbInstance = db;
        const eventsTicketsConfigurationJoin = tEventsTicketsConfiguration.forUseInLeftJoin();

        const mostRecentUpdate = await dbInstance.selectFrom(tWeeztixOrders)
            .where(tWeeztixOrders.weeztixEventGuid.equals(this.#eventId))
            .selectOneColumn(dbInstance.max(tWeeztixOrders.weeztixOrderUpdated))
            .executeSelectNoneOrOne() ?? undefined;

        const pendingCategorisationCount = await dbInstance.selectFrom(tWeeztixTicketTypes)
            .leftJoin(eventsTicketsConfigurationJoin)
                .on(eventsTicketsConfigurationJoin.eventId.equals(eventId))
                    .and(eventsTicketsConfigurationJoin.eventTicketWeeztixGuid.equals(
                        tWeeztixTicketTypes.weeztixGuid))
            .where(tWeeztixTicketTypes.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixTicketTypes.weeztixTicketDeleted.isNull())
                .and(eventsTicketsConfigurationJoin.eventTicketCategory.isNull())
            .selectCountAll()
            .executeSelectOne();

        return {
            mostRecentUpdate,
            pendingCategorisationCount,
        };
    }

    async getStatistics(): Promise<TicketStatistics | undefined> {
        const dbInstance = db;
        const cutoffDate = Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: 7 });

        const ticketRows = await dbInstance.selectFrom(tWeeztixTickets)
            .innerJoin(tWeeztixOrders)
                .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixTickets.weeztixOrderGuid))
            .where(tWeeztixTickets.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixTickets.weeztixTicketDeleted.isNull())
                .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
                .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
            .select({
                complimentary: tWeeztixTickets.weeztixTicketPrice.equals(0),
                inLastWeek: tWeeztixTickets.weeztixTicketCreated.greaterOrEqual(cutoffDate),
                count: dbInstance.countAll(),
            })
            .groupBy('complimentary', 'inLastWeek')
            .executeSelectMany();

        const parentTicketsJoin = tWeeztixTickets.forUseInLeftJoin();

        const purchaseRows = await dbInstance.selectFrom(tWeeztixPurchases)
            .innerJoin(tWeeztixTicketTypes)
                .on(tWeeztixTicketTypes.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixTicketTypes.weeztixGuid.equals(
                        tWeeztixPurchases.weeztixPurchaseTypeGuid))
                    .and(tWeeztixTicketTypes.weeztixTicketType.equals(kWeeztixTicketType.Product))
            .innerJoin(tWeeztixOrders)
                .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixPurchases.weeztixOrderGuid))
            .leftJoin(parentTicketsJoin)
                .on(parentTicketsJoin.weeztixGuid.equals(tWeeztixPurchases.weeztixTicketGuid))
            .where(tWeeztixPurchases.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixPurchases.weeztixPurchaseDeleted.isNull())
                .and(parentTicketsJoin.weeztixTicketDeleted.isNull())
                .and(tWeeztixOrders.weeztixOrderDeleted.isNull())
                .and(tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses))
            .select({
                complimentary: tWeeztixPurchases.weeztixPurchasePrice.equals(0),
                inLastWeek: tWeeztixPurchases.weeztixPurchaseCreated.greaterOrEqual(cutoffDate),
                count: dbInstance.countAll(),
            })
            .groupBy('complimentary', 'inLastWeek')
            .executeSelectMany();

        const statistics: TicketStatistics = {
            tickets: { purchases: 0, guestList: 0 },
            subproducts: { purchases: 0, guestList: 0 },
            lastWeek: { purchases: 0, guestList: 0 },
            total: { purchases: 0, guestList: 0 },
        };

        for (const row of ticketRows) {
            const key = row.complimentary ? 'guestList' : 'purchases';
            statistics.tickets[key] += row.count;
            statistics.total[key] += row.count;
            if (row.inLastWeek)
                statistics.lastWeek[key] += row.count;
        }

        for (const row of purchaseRows) {
            const key = row.complimentary ? 'guestList' : 'purchases';
            statistics.subproducts[key] += row.count;
            statistics.total[key] += row.count;
            if (row.inLastWeek)
                statistics.lastWeek[key] += row.count;
        }

        return statistics;
    }

    async hasSales(): Promise<boolean> {
        return hasWeeztixSales(this.#eventId);
    }

    async importPurchase(_purchaseId: number | string): Promise<void> {
        // Weeztix purchases are imported asynchronously via the scheduled import task.
    }

    async listTicketConfigurations(eventId: number): Promise<TicketConfiguration[]> {
        return listTicketConfigurationsByProvider(eventId, 'Weeztix');
    }

    async listTicketTypes(): Promise<TicketType[]> {
        const rows = await db.selectFrom(tWeeztixTicketTypes)
            .where(tWeeztixTicketTypes.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixTicketTypes.weeztixTicketDeleted.isNull())
            .select({
                id: tWeeztixTicketTypes.weeztixGuid,
                name: tWeeztixTicketTypes.weeztixTicketName,
                price: tWeeztixTicketTypes.weeztixTicketPrice,
                available: tWeeztixTicketTypes.weeztixTicketAvailable,
                sold: tWeeztixTicketTypes.weeztixTicketSold,
                status: tWeeztixTicketTypes.weeztixTicketStatus,
            })
            .orderBy('name', 'asc')
            .executeSelectMany();

        return rows.map(row => ({
            id: row.id,
            name: row.name.trim(),
            price: row.price,
            active: row.status === 'available' || (row.status === 'auto' && row.available > 0),
            sold: row.sold,
            amount: computeWeeztixTicketCapacity(row.available, row.sold, row.status),
        }));
    }

    async listTicketsForType(id: number | string): Promise<Ticket[]> {
        const dbInstance = db;
        const typeGuid = String(id);

        const ticketType = await dbInstance.selectFrom(tWeeztixTicketTypes)
            .where(tWeeztixTicketTypes.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixTicketTypes.weeztixGuid.equals(typeGuid))
            .selectOneColumn(tWeeztixTicketTypes.weeztixTicketType)
            .executeSelectNoneOrOne();

        if (!ticketType)
            return [];

        if (ticketType === kWeeztixTicketType.Ticket) {
            const rows = await dbInstance.selectFrom(tWeeztixTickets)
                .innerJoin(tWeeztixOrders)
                    .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixTickets.weeztixOrderGuid))
                .where(tWeeztixTickets.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixTickets.weeztixTicketTypeGuid.equals(typeGuid))
                    .and(tWeeztixOrders.weeztixOrderStatus.notIn([ 'pending', 'expired' ]))
                .select({
                    id: tWeeztixTickets.weeztixGuid,
                    purchaseId: tWeeztixTickets.weeztixOrderGuid,
                    ticketId: tWeeztixTickets.weeztixTicketTypeGuid,
                    barcode: tWeeztixTickets.weeztixTicketBarcode,
                    name: tWeeztixTickets.weeztixTicketName,
                    nickname: tWeeztixTickets.weeztixTicketMetaNickname,
                    function: tWeeztixTickets.weeztixTicketMetaFunction,
                    organisation: tWeeztixTickets.weeztixTicketMetaOrganisation,
                    price: tWeeztixTickets.weeztixTicketPrice,
                    created: tWeeztixTickets.weeztixTicketCreated,
                    deleted: tWeeztixTickets.weeztixTicketDeleted,
                    orderName: tWeeztixOrders.weeztixOrderName,
                    orderStatus: tWeeztixOrders.weeztixOrderStatus,
                    orderUpdated: tWeeztixOrders.weeztixOrderUpdated,
                    orderDeleted: tWeeztixOrders.weeztixOrderDeleted,
                })
                .executeSelectMany();

            return rows.map(toTicket);
        }

        const ticketsJoin = tWeeztixTickets.forUseInLeftJoin();

        const rows = await dbInstance.selectFrom(tWeeztixPurchases)
            .innerJoin(tWeeztixOrders)
                .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixPurchases.weeztixOrderGuid))
            .leftJoin(ticketsJoin)
                .on(ticketsJoin.weeztixGuid.equals(tWeeztixPurchases.weeztixTicketGuid))
            .where(tWeeztixPurchases.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixPurchases.weeztixPurchaseTypeGuid.equals(typeGuid))
                .and(tWeeztixOrders.weeztixOrderStatus.notIn([ 'pending', 'expired' ]))
            .select({
                id: tWeeztixPurchases.weeztixGuid,
                purchaseId: tWeeztixPurchases.weeztixOrderGuid,
                ticketId: tWeeztixPurchases.weeztixPurchaseTypeGuid,
                barcode: ticketsJoin.weeztixTicketBarcode,
                name: tWeeztixPurchases.weeztixPurchaseName,
                function: ticketsJoin.weeztixTicketMetaFunction,
                organisation: ticketsJoin.weeztixTicketMetaOrganisation,
                parentTicketName: ticketsJoin.weeztixTicketName,
                price: tWeeztixPurchases.weeztixPurchasePrice,
                created: tWeeztixPurchases.weeztixPurchaseCreated,
                deleted: tWeeztixPurchases.weeztixPurchaseDeleted,
                parentTicketDeleted: ticketsJoin.weeztixTicketDeleted,
                orderName: tWeeztixOrders.weeztixOrderName,
                orderStatus: tWeeztixOrders.weeztixOrderStatus,
                orderUpdated: tWeeztixOrders.weeztixOrderUpdated,
                orderDeleted: tWeeztixOrders.weeztixOrderDeleted,
            })
            .executeSelectMany();

        return rows.map(toTicket);
    }

    async listVolunteerTickets(eventId: number, userIds?: number[])
        : Promise<Map<number, VolunteerTicket>>
    {
        if (userIds && !userIds.length)
            return new Map();

        const dbInstance = db;

        const rows = await dbInstance.selectFrom(tUsersEventsTickets)
            .innerJoin(tWeeztixOrders)
                .on(tWeeztixOrders.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixOrders.weeztixGuid.equals(
                        tUsersEventsTickets.ticketProviderPurchaseId))
            .where(tUsersEventsTickets.eventId.equals(eventId))
                .and(tUsersEventsTickets.ticketProvider.equals('Weeztix'))
                .and(tUsersEventsTickets.userId.inIfValue(userIds))
            .select({
                userId: tUsersEventsTickets.userId,
                purchaseId: tWeeztixOrders.weeztixGuid,
                paid: dbInstance.dateTimeAsString(tWeeztixOrders.weeztixOrderCreated),
                orderStatus: tWeeztixOrders.weeztixOrderStatus,
                cancelled: tWeeztixOrders.weeztixOrderDeleted.isNotNull().or(
                    tWeeztixOrders.weeztixOrderStatus.equals('cancelled')),
            })
            .executeSelectMany();

        const tickets = new Map<number, VolunteerTicket>();
        for (const row of rows) {
            tickets.set(row.userId, {
                purchaseId: row.purchaseId,
                paid: kWeeztixSettledOrderStatuses.includes(row.orderStatus) ? row.paid : undefined,
                cancelled: row.cancelled,
            });
        }

        return tickets;
    }

    async searchTickets(request: TicketSearchRequest): Promise<TicketSearchResults> {
        const dbInstance = db;
        const { query } = request;

        const ticketTypesJoin = tWeeztixTicketTypes.forUseInLeftJoin();

        const ticketHolder = dbInstance.fragmentWithType('string', 'optional').sql`
            NULLIF(TRIM(COALESCE(
                NULLIF(TRIM(${tWeeztixTickets.weeztixTicketName}), ''),
                NULLIF(TRIM(${tWeeztixOrders.weeztixOrderName}), '')
            )), '')`;

        const ticketPurchased = dbInstance.fragmentWithType('string', 'optional').sql`
            CASE WHEN ${tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses)}
                THEN ${dbInstance.dateTimeAsString(tWeeztixTickets.weeztixTicketCreated)}
                ELSE NULL
            END`;

        const ticketsQuery = dbInstance.selectFrom(tWeeztixTickets)
            .innerJoin(tWeeztixOrders)
                .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixTickets.weeztixOrderGuid))
            .leftJoin(ticketTypesJoin)
                .on(ticketTypesJoin.weeztixEventGuid.equals(this.#eventId))
                    .and(ticketTypesJoin.weeztixGuid.equals(
                        tWeeztixTickets.weeztixTicketTypeGuid))
            .where(tWeeztixTickets.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixOrders.weeztixOrderStatus.notIn([ 'pending', 'expired' ]))
                .and(
                    tWeeztixTickets.weeztixTicketName.containsInsensitive(query).or(
                    tWeeztixTickets.weeztixTicketMetaNickname.containsInsensitive(query).or(
                    tWeeztixOrders.weeztixOrderName.containsInsensitive(query).or(
                    ticketTypesJoin.weeztixTicketName.containsInsensitive(query).or(
                    tWeeztixTickets.weeztixGuid.containsInsensitive(query).or(
                    tWeeztixTickets.weeztixOrderGuid.containsInsensitive(query).or(
                    tWeeztixTickets.weeztixTicketBarcode.containsInsensitive(query))))))))
            .select({
                id: tWeeztixTickets.weeztixGuid,
                purchaseId: tWeeztixTickets.weeztixOrderGuid,
                ticketId: tWeeztixTickets.weeztixTicketTypeGuid,
                holder: ticketHolder,
                ticketName: ticketTypesJoin.weeztixTicketName.asOptional(),
                purchased: ticketPurchased,
                cancelled: tWeeztixTickets.weeztixTicketDeleted.isNotNull().or(
                    tWeeztixOrders.weeztixOrderDeleted.isNotNull()).or(
                    tWeeztixOrders.weeztixOrderStatus.equals('cancelled')),
                complimentary: tWeeztixTickets.weeztixTicketPrice.equals(0),
            });

        const parentTicketsJoin = tWeeztixTickets.forUseInLeftJoin();

        const purchaseHolder = dbInstance.fragmentWithType('string', 'optional').sql`
            NULLIF(TRIM(COALESCE(
                NULLIF(TRIM(${tWeeztixPurchases.weeztixPurchaseName}), ''),
                NULLIF(TRIM(${parentTicketsJoin.weeztixTicketName}), ''),
                NULLIF(TRIM(${tWeeztixOrders.weeztixOrderName}), '')
            )), '')`;

        const purchasePurchased = dbInstance.fragmentWithType('string', 'optional').sql`
            CASE WHEN ${tWeeztixOrders.weeztixOrderStatus.in(kWeeztixSettledOrderStatuses)}
                THEN ${dbInstance.dateTimeAsString(tWeeztixPurchases.weeztixPurchaseCreated)}
                ELSE NULL
            END`;

        const purchasesQuery = dbInstance.selectFrom(tWeeztixPurchases)
            .innerJoin(tWeeztixTicketTypes)
                .on(tWeeztixTicketTypes.weeztixEventGuid.equals(this.#eventId))
                    .and(tWeeztixTicketTypes.weeztixGuid.equals(
                        tWeeztixPurchases.weeztixPurchaseTypeGuid))
                    .and(tWeeztixTicketTypes.weeztixTicketType.equals(kWeeztixTicketType.Product))
            .innerJoin(tWeeztixOrders)
                .on(tWeeztixOrders.weeztixGuid.equals(tWeeztixPurchases.weeztixOrderGuid))
            .leftJoin(parentTicketsJoin)
                .on(parentTicketsJoin.weeztixGuid.equals(tWeeztixPurchases.weeztixTicketGuid))
            .where(tWeeztixPurchases.weeztixEventGuid.equals(this.#eventId))
                .and(tWeeztixOrders.weeztixOrderStatus.notIn([ 'pending', 'expired' ]))
                .and(
                    tWeeztixPurchases.weeztixPurchaseName.containsInsensitive(query).or(
                    parentTicketsJoin.weeztixTicketName.containsInsensitive(query).or(
                    parentTicketsJoin.weeztixTicketMetaNickname.containsInsensitive(query).or(
                    tWeeztixOrders.weeztixOrderName.containsInsensitive(query).or(
                    tWeeztixTicketTypes.weeztixTicketName.containsInsensitive(query).or(
                    tWeeztixPurchases.weeztixGuid.containsInsensitive(query).or(
                    tWeeztixPurchases.weeztixOrderGuid.containsInsensitive(query).or(
                    parentTicketsJoin.weeztixTicketBarcode.containsInsensitive(query)))))))))
            .select({
                id: tWeeztixPurchases.weeztixGuid,
                purchaseId: tWeeztixPurchases.weeztixOrderGuid,
                ticketId: tWeeztixPurchases.weeztixPurchaseTypeGuid,
                holder: purchaseHolder,
                ticketName: tWeeztixTicketTypes.weeztixTicketName.asOptional(),
                purchased: purchasePurchased,
                cancelled: tWeeztixPurchases.weeztixPurchaseDeleted.isNotNull().or(
                    parentTicketsJoin.weeztixTicketDeleted.isNotNull()).or(
                    tWeeztixOrders.weeztixOrderDeleted.isNotNull()).or(
                    tWeeztixOrders.weeztixOrderStatus.equals('cancelled')),
                complimentary: tWeeztixPurchases.weeztixPurchasePrice.equals(0),
            });

        const sortField = kTicketSearchSortFieldMap[request.sort?.field ?? 'purchased'];
        const sortDirection = request.sort?.direction ?? 'desc';

        const { count, data } = await ticketsQuery.unionAll(purchasesQuery)
            .orderBy(sortField, sortDirection)
            .limit(request.limit)
                .offset(request.offset)
            .executeSelectPage();

        return {
            count,
            results: data,
        };
    }

    async sendPurchaseConfirmation(purchaseId: number | string): Promise<boolean> {
        return false;
    }

    async upsertTicketConfiguration(
        eventId: number,
        ticketTypeId: number | string,
        config: { activityId: number | null; category: EventTicketCategory | null }): Promise<boolean>
    {
        return upsertTicketConfigurationByProvider(eventId, 'Weeztix', ticketTypeId, config);
    }
}
