// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory, EventTicketProvider } from '@lib/database/Types';
import type { FinancialFilter, FinancialFilterOptions, ProviderProduct, ProviderProductSales,
    Purchase, Ticket, TicketConfiguration, TicketCreateRequest, TicketFinancialSummary,
    TicketSearchRequest, TicketSearchResults, TicketStatistics, TicketType, VolunteerTicket }
    from '../Types';
import type { TicketService } from '../TicketService';
import { YourTicketProviderImportTask } from '@lib/scheduler/tasks/YourTicketProviderImportTask';
import { fetchYourTicketProviderProductSales, fetchYourTicketProviderProducts,
    hasYourTicketProviderSales } from './YourTicketProviderFinancialData';
import { kTicketSearchSortFieldMap, listTicketConfigurationsByProvider,
    upsertTicketConfigurationByProvider } from '../TicketHelpers';

import db, { tEventsTicketsConfiguration, tUsersEventsTickets, tYourTicketProviderPurchases,
    tYourTicketProviderTickets } from '@lib/database';

/**
 * Implementation of the `TicketService` specific to YourTicketProvider and/or CM.com.
 * @see https://ytpstorage1.blob.core.windows.net/media/YTP%20Ticketing%20API%20Specifications.pdf
 */
export class YourTicketProvider implements TicketService {
    #eventId: number;

    constructor(eventId: number) {
        this.#eventId = eventId;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketService implementation:
    // ---------------------------------------------------------------------------------------------

    get id(): EventTicketProvider { return 'YourTicketProvider' };
    get eventId(): number | string { return this.#eventId; }

    async anonymizeTickets(): Promise<number> {
        return db.update(tYourTicketProviderPurchases)
            .set({
                ytpPurchaseItemHolder: '(anonymized)',
            })
            .where(tYourTicketProviderPurchases.ytpPurchaseItemHolder.isNotNull())
                .and(tYourTicketProviderPurchases.ytpPurchaseItemHolder.notEquals('(anonymized)'))
                .and(tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(/* false= */ 0))
                .and(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
            .executeUpdate();
    }

    createPurchaseLink(purchaseId: number | string): string | undefined {
        const baseUrl = 'https://www.yourticketprovider.nl/account/events/manage/guests';
        return `${baseUrl}/purchaseitems.aspx?y=${this.#eventId}&purchaseid=${purchaseId}`;
    }

    canCancelPurchases(): boolean {
        return false;
    }

    canCreateTickets(): boolean {
        return false;
    }

    canManageVolunteerTickets(): boolean {
        return false;
    }

    async cancelPurchase(purchaseId: number | string): Promise<void> {
        throw new Error('Not implemented');
    }

    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        throw new Error('Not implemented');
    }

    async fetchFinancialFilterOptions(): Promise<FinancialFilterOptions> {
        return { utmSources: [], utmCampaigns: [] };
    }

    async fetchFinancialProducts(eventId: number, _filter?: FinancialFilter)
        : Promise<ProviderProduct[]>
    {
        return fetchYourTicketProviderProducts(eventId, this.#eventId);
    }

    async fetchProductSales(eventId: number, productIds: number[], _filter?: FinancialFilter)
        : Promise<ProviderProductSales[]>
    {
        return fetchYourTicketProviderProductSales(eventId, this.#eventId, productIds);
    }

    async fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined> {
        const dbInstance = db;

        const yourTicketProviderTicketsJoin = tYourTicketProviderTickets.forUseInLeftJoin();

        return await dbInstance.selectFrom(tYourTicketProviderPurchases)
            .leftJoin(yourTicketProviderTicketsJoin)
                .on(yourTicketProviderTicketsJoin.ytpTicketId.equals(
                    tYourTicketProviderPurchases.ytpPurchaseItemTicketId))
            .where(tYourTicketProviderPurchases.ytpPurchaseId.equals(Number(purchaseId)))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseId,
                eventId: tYourTicketProviderPurchases.ytpPurchaseEventId,
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled,
                paid: tYourTicketProviderPurchases.ytpPurchaseDatePaid,
                tickets: dbInstance.aggregateAsArray({
                    id: tYourTicketProviderPurchases.ytpPurchaseItemId,
                    ticketId: tYourTicketProviderPurchases.ytpPurchaseItemTicketId,
                    ticketName: yourTicketProviderTicketsJoin.ytpTicketName,
                    barcode: tYourTicketProviderPurchases.ytpPurchaseItemBarcode,
                    holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                }),
            })
            .groupBy(tYourTicketProviderPurchases.ytpPurchaseId)
            .executeSelectNoneOrOne() ?? undefined;
    }

    formatPurchaseId(purchaseId: number | string): string {
        return `REF${purchaseId}`;
    }

    formatTicketId(ticketId: number | string): string {
        return String(ticketId);
    }

    async getFinancialSummary(eventId: number): Promise<TicketFinancialSummary> {
        const dbInstance = db;
        const eventsTicketsConfigurationJoin = tEventsTicketsConfiguration.forUseInLeftJoin();

        const mostRecentUpdate = await dbInstance.selectFrom(tYourTicketProviderPurchases)
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
            .selectOneColumn(dbInstance.max(tYourTicketProviderPurchases.ytpPurchaseItemUpdated))
            .executeSelectNoneOrOne() ?? undefined;

        const pendingCategorisationCount = await dbInstance.selectFrom(tYourTicketProviderTickets)
            .leftJoin(eventsTicketsConfigurationJoin)
                .on(eventsTicketsConfigurationJoin.eventId.equals(eventId))
                    .and(eventsTicketsConfigurationJoin.eventTicketYtpId.equals(
                        tYourTicketProviderTickets.ytpTicketId))
            .where(tYourTicketProviderTickets.ytpTicketEventId.equals(this.#eventId))
                .and(tYourTicketProviderTickets.ytpTicketDeleted.isNull())
                .and(eventsTicketsConfigurationJoin.eventTicketCategory.isNull())
            .selectCountAll()
            .executeSelectOne();

        return {
            mostRecentUpdate,
            pendingCategorisationCount,
        };
    }

    async getStatistics(): Promise<TicketStatistics | undefined> {
        const ticketsJoin = tYourTicketProviderTickets.forUseInLeftJoin();

        const results = await db.selectFrom(tYourTicketProviderPurchases)
            .leftJoin(ticketsJoin)
                .on(ticketsJoin.ytpTicketId.equals(tYourTicketProviderPurchases.ytpPurchaseItemTicketId))
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
                .and(tYourTicketProviderPurchases.ytpPurchaseDateCancelled.isNull())
            .select({
                complimentary: tYourTicketProviderPurchases.ytpPurchaseComplimentary,
                datePaid: tYourTicketProviderPurchases.ytpPurchaseDatePaid,
                isSubproduct: ticketsJoin.ytpTicketIsSubproduct,
            })
            .executeSelectMany();

        const statistics: TicketStatistics = {
            tickets: { purchases: 0, guestList: 0 },
            subproducts: { purchases: 0, guestList: 0 },
            lastWeek: { purchases: 0, guestList: 0 },
            total: { purchases: 0, guestList: 0 },
        };

        const cutoffDate = Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: 7 });

        for (const row of results) {
            const isPaidInLastWeek = row.datePaid
                ? Temporal.ZonedDateTime.compare(row.datePaid, cutoffDate) >= 0
                : false;

            if (row.isSubproduct) {
                row.complimentary ? statistics.subproducts.guestList++
                                  : statistics.subproducts.purchases++;
            } else {
                row.complimentary ? statistics.tickets.guestList++
                                  : statistics.tickets.purchases++;
            }

            if (row.complimentary) {
                statistics.total.guestList++;
                if (isPaidInLastWeek)
                    statistics.lastWeek.guestList++;

            } else {
                statistics.total.purchases++;
                if (isPaidInLastWeek)
                    statistics.lastWeek.purchases++;
            }
        }

        return statistics;
    }

    async hasSales(): Promise<boolean> {
        return hasYourTicketProviderSales(this.#eventId);
    }

    async importPurchase(purchaseId: number | string): Promise<void> {
        await YourTicketProviderImportTask.importPurchase(this.#eventId, Number(purchaseId));
    }

    async listTicketConfigurations(eventId: number): Promise<TicketConfiguration[]> {
        return listTicketConfigurationsByProvider(eventId, 'YourTicketProvider');
    }

    async listTicketTypes(): Promise<TicketType[]> {
        const purchasesJoin = tYourTicketProviderPurchases.forUseInLeftJoin();

        return db.selectFrom(tYourTicketProviderTickets)
            .leftJoin(purchasesJoin)
                .on(purchasesJoin.ytpPurchaseItemTicketId.equals(tYourTicketProviderTickets.ytpTicketId))
                    .and(purchasesJoin.ytpPurchaseDateCancelled.isNull())
            .where(tYourTicketProviderTickets.ytpTicketEventId.equals(this.#eventId))
                .and(tYourTicketProviderTickets.ytpTicketDeleted.isNull())
            .select({
                id: tYourTicketProviderTickets.ytpTicketId,
                name: tYourTicketProviderTickets.ytpTicketName.trim(),
                price: tYourTicketProviderTickets.ytpTicketPrice,
                active: tYourTicketProviderTickets.ytpTicketLive.equals(/* true= */ 1),
                sold: db.count(purchasesJoin.ytpPurchaseItemId),
                amount: tYourTicketProviderTickets.ytpTicketAmount,
            })
            .groupBy(tYourTicketProviderTickets.ytpTicketId)
            .executeSelectMany();
    }

    async listTicketsForType(ticketId: number | string): Promise<Ticket[]> {
        return db.selectFrom(tYourTicketProviderPurchases)
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
                .and(tYourTicketProviderPurchases.ytpPurchaseItemTicketId.equals(Number(ticketId)))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseItemId,
                purchaseId: tYourTicketProviderPurchases.ytpPurchaseId,
                ticketId: tYourTicketProviderPurchases.ytpPurchaseItemTicketId,
                barcode: tYourTicketProviderPurchases.ytpPurchaseItemBarcode,
                holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                complimentary: tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(1),
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled,
                paid: tYourTicketProviderPurchases.ytpPurchaseDatePaid,
            })
            .executeSelectMany();
    }

    async listVolunteerTickets(eventId: number, userIds?: number[])
        : Promise<Map<number, VolunteerTicket>>
    {
        if (userIds && !userIds.length)
            return new Map();

        const dbInstance = db;

        const purchaseIdCast = dbInstance.fragmentWithType('int', 'optional')
            .sql`CAST(${tUsersEventsTickets.ticketProviderPurchaseId} AS INTEGER)`;

        const rows = await dbInstance.selectFrom(tUsersEventsTickets)
            .innerJoin(tYourTicketProviderPurchases)
                .on(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
                    .and(tYourTicketProviderPurchases.ytpPurchaseId.equals(purchaseIdCast))
            .where(tUsersEventsTickets.eventId.equals(eventId))
                .and(tUsersEventsTickets.ticketProvider.equals('YourTicketProvider'))
                .and(tUsersEventsTickets.userId.inIfValue(userIds))
            .select({
                userId: tUsersEventsTickets.userId,
                purchaseId: tYourTicketProviderPurchases.ytpPurchaseId,
                paid: dbInstance.dateTimeAsString(
                    tYourTicketProviderPurchases.ytpPurchaseDatePaid),
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled.isNotNull(),
            })
            .groupBy(tUsersEventsTickets.userId)
            .executeSelectMany();

        const tickets = new Map<number, VolunteerTicket>();
        for (const row of rows) {
            tickets.set(row.userId, {
                purchaseId: row.purchaseId,
                paid: row.paid,
                cancelled: row.cancelled,
            });
        }

        return tickets;
    }

    async searchTickets(request: TicketSearchRequest): Promise<TicketSearchResults> {
        const dbInstance = db;

        const purchaseIdCast = dbInstance.fragmentWithType('string', 'required')
            .sql`CAST(${tYourTicketProviderPurchases.ytpPurchaseId} AS CHAR)`;
        const ticketIdCast = dbInstance.fragmentWithType('string', 'required')
            .sql`CAST(${tYourTicketProviderPurchases.ytpPurchaseItemId} AS CHAR)`;

        const sortField = kTicketSearchSortFieldMap[request.sort?.field ?? 'purchased'];
        const sortDirection = request.sort?.direction ?? 'desc';

        const purchases = await dbInstance.selectFrom(tYourTicketProviderPurchases)
            .innerJoin(tYourTicketProviderTickets)
                .on(tYourTicketProviderTickets.ytpTicketId.equals(
                    tYourTicketProviderPurchases.ytpPurchaseItemTicketId))
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
                .and(
                    tYourTicketProviderPurchases.ytpPurchaseItemHolder.containsInsensitive(
                        request.query).or(
                    tYourTicketProviderTickets.ytpTicketName.containsInsensitive(request.query).or(
                    purchaseIdCast.containsInsensitive(request.query).or(
                    ticketIdCast.containsInsensitive(request.query)))))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseItemId,
                purchaseId: tYourTicketProviderPurchases.ytpPurchaseId,
                ticketId: tYourTicketProviderPurchases.ytpPurchaseItemTicketId,
                holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                ticketName: tYourTicketProviderTickets.ytpTicketName,
                purchased: dbInstance.dateTimeAsString(
                    tYourTicketProviderPurchases.ytpPurchaseDatePaid),
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled.isNotNull(),
                complimentary: tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(1),
            })
            .orderBy(sortField, sortDirection)
            .limit(request.limit)
                .offset(request.offset)
            .executeSelectPage();

        return {
            count: purchases.count,
            results: purchases.data,
        };
    }

    async sendPurchaseConfirmation(purchaseId: number | string): Promise<boolean> {
        throw new Error('Not implemented');
    }

    async upsertTicketConfiguration(
        eventId: number,
        ticketTypeId: number | string,
        config: { activityId: number | null; category: EventTicketCategory | null }): Promise<boolean>
    {
        return upsertTicketConfigurationByProvider(
            eventId, 'YourTicketProvider', ticketTypeId, config);
    }
}
