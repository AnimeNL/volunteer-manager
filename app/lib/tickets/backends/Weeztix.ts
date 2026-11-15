// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketProvider } from '@lib/database/Types';
import type { Purchase, Ticket, TicketCreateRequest, TicketStatistics, TicketType } from '../Types';
import type { TicketService } from '../TicketService';
import type { WeeztixClient } from '@lib/integrations/weeztix';
import { createWeeztixClient } from '@lib/integrations/weeztix';
import db, { tWeeztixOrders, tWeeztixPurchases, tWeeztixTicketTypes, tWeeztixTickets } from '@lib/database';

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
    const paid =
        row.orderStatus === 'paid' || row.orderStatus === 'swapped' ? row.created : undefined;
    const cancelled =
        row.deleted ?? row.parentTicketDeleted ?? row.orderDeleted ??
        (row.orderStatus === 'cancelled' ? row.orderUpdated : undefined);

    return {
        id: row.id,
        purchaseId: row.purchaseId,
        ticketId: row.ticketId,
        barcode: row.barcode || undefined,
        holder,
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
    #client: WeeztixClient | undefined;
    #eventId: string;

    constructor(eventId: string) {
        this.#eventId = eventId;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketService implementation:
    // ---------------------------------------------------------------------------------------------

    get id(): EventTicketProvider { return 'Weeztix' };
    get eventId(): number | string { return this.#eventId; }

    async getClient(): Promise<WeeztixClient> {
        this.#client ??= await createWeeztixClient();
        return this.#client;
    }

    async cancelPurchase(purchaseId: number | string): Promise<void> {
        throw new Error('Not yet implemented');
    }

    createPurchaseLink(purchaseId: number | string): string | undefined {
        throw new Error('Not yet implemented');
    }

    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        throw new Error('Not yet implemented');
    }

    async fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined> {
        throw new Error('Not yet implemented');
    }

    formatPurchaseId(purchaseId: number | string): string {
        throw new Error('Not yet implemented');
    }

    async getStatistics(): Promise<TicketStatistics | undefined> {
        throw new Error('Not yet implemented');
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
            amount: row.available + row.sold,
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

    async sendPurchaseConfirmation(purchaseId: number | string): Promise<boolean> {
        return false;
    }
}
