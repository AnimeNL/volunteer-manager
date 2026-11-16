// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Order } from '@lib/integrations/weeztix/WeeztixTypes';
import type { WeeztixClient } from '@lib/integrations/weeztix';
import type { WeeztixTicketType } from '@lib/database/Types';
import { FinanceProcessor } from '@app/admin/events/[event]/finance/FinanceProcessor';
import { Task } from '../Task';
import { createWeeztixClient } from '@lib/integrations/weeztix';
import db, { tEvents, tWeeztixOrders, tWeeztixPurchases, tWeeztixTicketTypes, tWeeztixTickets } from '@lib/database';

import { kWeeztixTicketType } from '@lib/database/Types';

/**
 * Configuration options available for the `WeeztixImportTask` mechanism.
 */
interface WeeztixImportTaskConfiguration {
    /**
     * Number of milliseconds of delay to impose between fetching paginated order batches.
     */
    delayBetweenOrderPagesMs: number;

    /**
     * Maximum number of order pages to retrieve from the statistics endpoint per execution.
     */
    maximumOrderPagesPerExecution: number;

    /**
     * Maximum number of orders to retrieve per statistics endpoint request.
     */
    maximumOrdersPerPage: number;

    /**
     * Number of hours to subtract from the most recent update to compensate for race conditions in
     * the update process, i.e. failures or overlapping requests.
     */
    raceConditionCompensationHours: number;
}

/**
 * Normalised representation of a live Weeztix order returned by the API.
 */
interface LiveOrderEntry {
    guid: string;
    name: string | null;
    status: string;
    created: Temporal.ZonedDateTime;
    updated: Temporal.ZonedDateTime;
    deleted: Temporal.ZonedDateTime | null;
}

/**
 * Normalised representation of a live Weeztix purchase returned by the API.
 */
interface LivePurchaseEntry {
    guid: string;
    ticketGuid: string | null;
    orderGuid: string;
    typeGuid: string;
    name: string | null;
    price: number;
    created: Temporal.ZonedDateTime;
    updated: Temporal.ZonedDateTime;
    deleted: Temporal.ZonedDateTime | null;
}

/**
 * Normalised representation of a live Weeztix ticket returned by the API.
 */
interface LiveTicketEntry {
    guid: string;
    orderGuid: string;
    typeGuid: string;
    barcode: string;
    name: string | null;
    nickname: string | null;
    price: number;
    created: Temporal.ZonedDateTime;
    updated: Temporal.ZonedDateTime;
    deleted: Temporal.ZonedDateTime | null;
}

/**
 * Normalised representation of a live Weeztix product or ticket type returned by the API.
 */
interface LiveTicketTypeEntry {
    guid: string;
    type: WeeztixTicketType;
    name: string;
    description: string | null;
    price: number;
    available: number;
    sold: number;
    scanned: number;
    status: string;
    created: Temporal.ZonedDateTime;
    updated: Temporal.ZonedDateTime;
}

/**
 * Returns whether optional `lhs` and `rhs` timestamps represent the same instant at second
 * precision, or are both absent.
 */
function areOptionalTimestampsEqual(
    lhs?: Temporal.ZonedDateTime | null, rhs?: Temporal.ZonedDateTime | null): boolean
{
    if (!lhs && !rhs)
        return true;
    if (!lhs || !rhs)
        return false;

    return areTimestampsEqual(lhs, rhs);
}

/**
 * Returns whether `lhs` and `rhs` represent the same instant at second precision.
 */
function areTimestampsEqual(lhs: Temporal.ZonedDateTime, rhs: Temporal.ZonedDateTime): boolean {
    return Temporal.ZonedDateTime.compare(lhs.round('seconds'), rhs.round('seconds')) === 0;
}

/**
 * Extracts the personalised holder name (`first_name` and `last_name`) from ticket or purchase
 * `metadata`, returning `null` when neither is present.
 */
function extractHolderName(metadata: Order['tickets'][number]['meta_data']): string | null {
    let firstName: string | undefined;
    let lastName: string | undefined;

    for (const entry of metadata) {
        if (typeof entry.value === 'boolean')
            continue;

        if (entry.meta_data.name === 'first_name')
            firstName = String(entry.value);
        else if (entry.meta_data.name === 'last_name')
            lastName = String(entry.value);
    }

    return [ firstName, lastName ]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;
}

/**
 * Extracts the optional nickname from ticket `metadata`, matching any field whose name starts with
 * "Nickname" (case-insensitive, ignoring leading whitespace), returning `null` when absent.
 */
function extractNickname(metadata: Order['tickets'][number]['meta_data']): string | null {
    for (const entry of metadata) {
        if (typeof entry.value === 'boolean')
            continue;

        if (entry.meta_data.name.trimStart().toLowerCase().startsWith('nickname')) {
            const nickname = String(entry.value).replace(/\s+/g, ' ').trim();
            if (nickname)
                return nickname;
        }
    }

    return null;
}

/**
 * Parses an ISO 8601 timestamp string into a UTC `Temporal.ZonedDateTime` rounded to whole seconds.
 */
function parseTimestamp(value: string): Temporal.ZonedDateTime {
    return Temporal.Instant.from(value).round('seconds').toZonedDateTimeISO('UTC');
}

/**
 * Normalises a Weeztix `product` entry into a `LivePurchaseEntry` associated with `orderGuid` and
 * optionally `ticketGuid`.
 */
function toLivePurchaseEntry(
    product: Order['products'][number], orderGuid: string, ticketGuid: string | null)
        : LivePurchaseEntry
{
    return {
        guid: product.guid,
        ticketGuid,
        orderGuid,
        typeGuid: product.product_id,
        name: extractHolderName(product.meta_data),
        price: Math.max(0, Math.round(product.finn_price - product.finn_service_fee)),
        created: parseTimestamp(product.created_at),
        updated: parseTimestamp(product.updated_at),
        deleted: product.invalidated_since ? parseTimestamp(product.invalidated_since) : null,
    };
}

/**
 * Task that periodically imports order and ticket information from Weeztix.
 */
export class WeeztixImportTask extends Task {
    /**
     * The default interval for the import task, when no precise granularity can be decided upon.
     */
    static readonly kIntervalMaximum = /* 12 hours= */ 12 * 3600 * 1000;

    /**
     * Intervals for the tasks based on the number of days until the event happens.
     */
    static readonly kIntervalConfiguration = [
        { maximumDays: /*  2 weeks= */ 14, intervalMs: /* 1 hour= */      3600 * 1000 },
        { maximumDays: /*  4 weeks= */ 28, intervalMs: /* 3 hours= */ 3 * 3600 * 1000 },
        { maximumDays: /* 12 weeks= */ 56, intervalMs: /* 6 hours= */ 6 * 3600 * 1000 },
    ];

    #client: WeeztixClient = undefined!;
    #configuration: WeeztixImportTaskConfiguration = undefined!;

    /**
     * Initialises the `WeeztixImportTask` infrastructure.
     */
    private async initialise(): Promise<void> {
        this.#client = await createWeeztixClient();
        this.#configuration = {
            delayBetweenOrderPagesMs: 250,
            maximumOrderPagesPerExecution: 10,
            maximumOrdersPerPage: 100,
            raceConditionCompensationHours: 12,
        };
    }

    /**
     * Executes the task in the task scheduler's environment. Ticket types and orders will be
     * synchronised for all active and upcoming events configured to use Weeztix.
     */
    override async execute(): Promise<boolean> {
        await this.initialise();

        const dbInstance = db;
        const mostRecentUpdateSubQuery = dbInstance.subSelectUsing(tEvents)
            .from(tWeeztixOrders)
                .where(tWeeztixOrders.weeztixEventGuid.equals(tEvents.eventWeeztixGuid))
            .selectOneColumn(dbInstance.max(tWeeztixOrders.weeztixOrderUpdated))
            .forUseAsInlineQueryValue();

        const applicableEvents = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventHidden.equals(/* false= */ 0))
                .and(tEvents.eventEndTime.greaterOrEqual(dbInstance.currentZonedDateTime()))
                .and(tEvents.eventWeeztixGuid.isNotNull())
            .select({
                slug: tEvents.eventSlug,
                name: tEvents.eventShortName,
                endTime: tEvents.eventEndTime,
                context: {
                    companyGuid: tEvents.eventWeeztixCompanyGuid,
                    eventGuid: tEvents.eventWeeztixGuid,
                },
                mostRecentUpdate: mostRecentUpdateSubQuery,
            })
            .orderBy(tEvents.eventEndTime, 'asc')
            .executeSelectMany();

        if (!applicableEvents.length) {
            this.log.info('No active events configured with Weeztix were found.');
            this.setIntervalForRepeatingTask(WeeztixImportTask.kIntervalMaximum);
            return true;
        }

        for (const event of applicableEvents) {
            if (!event.context?.companyGuid)
                throw new Error(`Unable to update ${event.name} data without a company GUID`);
            if (!event.context?.eventGuid)
                throw new Error(`Unable to update ${event.name} data without an event GUID`);

            this.log.info(`Starting data import for ${event.name}`);

            await this.importProductsAndTickets(event.context.eventGuid);
            await this.importOrders(
                event.context.companyGuid, event.context.eventGuid, event.mostRecentUpdate);

            // Revalidate the financial cache, ensuring that all metrics and dashboards show the
            // most recently updated data.
            await FinanceProcessor.revalidateForEvent(event.slug);
        }

        this.updateTaskIntervalForFestivalDate(applicableEvents[0].endTime);

        return true;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Method to import the products and tickets that exist for the given `eventGuid`.
     */
    private async importProductsAndTickets(eventGuid: string): Promise<boolean> {
        this.log.info('[Tickets] Fetching products and tickets from the Weeztix API');

        const tickets = await this.#client.listTicketTypes(eventGuid);
        if (!tickets.length) {
            this.log.warning('[Tickets] No tickets were returned by the API; skipping');
            return false;
        }

        const liveEntries = new Map<string, LiveTicketTypeEntry>();
        let productCount = 0;

        for (const ticket of tickets) {
            const created = Temporal.Instant.from(ticket.created_at)
                .round('seconds').toZonedDateTimeISO('UTC');
            const updated = Temporal.Instant.from(ticket.updated_at)
                .round('seconds').toZonedDateTimeISO('UTC');

            liveEntries.set(ticket.guid, {
                guid: ticket.guid,
                type: kWeeztixTicketType.Ticket,
                name: ticket.name,
                description: ticket.description || null,
                price: Math.round(ticket.min_price),
                available: ticket.available_stock,
                sold: ticket.sold_count,
                scanned: ticket.scanned_count,
                status: ticket.status,
                created,
                updated,
            });

            for (const product of ticket.products) {
                if (product.origin_type !== 'product')
                    continue;  // tickets are their own products

                const existingProduct = liveEntries.get(product.guid);
                if (!existingProduct)
                    productCount++;

                const productCreated =
                    existingProduct &&
                    Temporal.ZonedDateTime.compare(existingProduct.created, created) < 0
                        ? existingProduct.created
                        : created;

                const productUpdated =
                    existingProduct &&
                    Temporal.ZonedDateTime.compare(existingProduct.updated, updated) > 0
                        ? existingProduct.updated
                        : updated;

                liveEntries.set(product.guid, {
                    guid: product.guid,
                    type: kWeeztixTicketType.Product,
                    name: product.name,
                    description: product.description || null,
                    price: Math.round(product.price),
                    available: product.available_stock,
                    sold: product.sold_count,
                    scanned: product.scanned_count,
                    status: product.status,
                    created: productCreated,
                    updated: productUpdated,
                });
            }
        }

        this.log.info(
            `[Tickets] Weeztix responded with ${tickets.length} ticket(s) and ` +
            `${productCount} product(s)`);

        const dbInstance = db;
        const knownEntries = await dbInstance.selectFrom(tWeeztixTicketTypes)
            .where(tWeeztixTicketTypes.weeztixEventGuid.equals(eventGuid))
            .select({
                guid: tWeeztixTicketTypes.weeztixGuid,
                type: tWeeztixTicketTypes.weeztixTicketType,
                name: tWeeztixTicketTypes.weeztixTicketName,
                description: tWeeztixTicketTypes.weeztixTicketDescription,
                price: tWeeztixTicketTypes.weeztixTicketPrice,
                available: tWeeztixTicketTypes.weeztixTicketAvailable,
                sold: tWeeztixTicketTypes.weeztixTicketSold,
                scanned: tWeeztixTicketTypes.weeztixTicketScanned,
                status: tWeeztixTicketTypes.weeztixTicketStatus,
                created: tWeeztixTicketTypes.weeztixTicketCreated,
                updated: tWeeztixTicketTypes.weeztixTicketUpdated,
                deleted: tWeeztixTicketTypes.weeztixTicketDeleted,
            })
            .executeSelectMany();

        const knownEntriesMap = new Map(knownEntries.map(entry => [ entry.guid, entry ]));

        const entriesToUpsert: LiveTicketTypeEntry[] = [];
        const guidsToDelete: string[] = [];

        let added = 0;
        let deleted = 0;
        let updated = 0;

        for (const liveEntry of liveEntries.values()) {
            const knownEntry = knownEntriesMap.get(liveEntry.guid);
            if (!knownEntry || !!knownEntry.deleted) {
                entriesToUpsert.push(liveEntry);
                added++;
                continue;
            }

            const hasChanged =
                knownEntry.type !== liveEntry.type ||
                knownEntry.name !== liveEntry.name ||
                (knownEntry.description || null) !== liveEntry.description ||
                knownEntry.price !== liveEntry.price ||
                knownEntry.available !== liveEntry.available ||
                knownEntry.sold !== liveEntry.sold ||
                knownEntry.scanned !== liveEntry.scanned ||
                knownEntry.status !== liveEntry.status ||
                !areTimestampsEqual(knownEntry.created, liveEntry.created) ||
                !areTimestampsEqual(knownEntry.updated, liveEntry.updated);

            if (hasChanged) {
                entriesToUpsert.push(liveEntry);
                updated++;
            }
        }

        for (const knownEntry of knownEntries) {
            if (!!knownEntry.deleted || liveEntries.has(knownEntry.guid))
                continue;

            guidsToDelete.push(knownEntry.guid);
            deleted++;
        }

        if (entriesToUpsert.length > 0 || guidsToDelete.length > 0) {
            await dbInstance.transaction(async () => {
                for (const entry of entriesToUpsert) {
                    const values = {
                        weeztixTicketType: entry.type,
                        weeztixTicketName: entry.name,
                        weeztixTicketDescription: entry.description,
                        weeztixTicketPrice: entry.price,
                        weeztixTicketAvailable: entry.available,
                        weeztixTicketSold: entry.sold,
                        weeztixTicketScanned: entry.scanned,
                        weeztixTicketStatus: entry.status,
                        weeztixTicketCreated: entry.created,
                        weeztixTicketUpdated: entry.updated,
                        weeztixTicketDeleted: null,
                    };

                    await dbInstance.insertInto(tWeeztixTicketTypes)
                        .set({
                            weeztixGuid: entry.guid,
                            weeztixEventGuid: eventGuid,
                            ...values,
                        })
                        .onConflictDoUpdateSet(values)
                        .executeInsert();
                }

                if (guidsToDelete.length > 0) {
                    await dbInstance.update(tWeeztixTicketTypes)
                        .set({
                            weeztixTicketDeleted: dbInstance.currentZonedDateTime(),
                        })
                        .where(tWeeztixTicketTypes.weeztixEventGuid.equals(eventGuid))
                            .and(tWeeztixTicketTypes.weeztixGuid.in(guidsToDelete))
                            .and(tWeeztixTicketTypes.weeztixTicketDeleted.isNull())
                        .executeUpdate();
                }
            });
        }

        this.log.info(`[Tickets] Added: ${added}, updated: ${updated}, deleted: ${deleted}`);
        return true;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Method to import the latest orders for the given `eventGuid` belonging to `companyGuid` that
     * were updated after the given `mostRecentUpdate`.
     */
    private async importOrders(
        companyGuid: string, eventGuid: string, mostRecentUpdate?: Temporal.ZonedDateTime)
            : Promise<boolean>
    {
        mostRecentUpdate ||= Temporal.Now.zonedDateTimeISO('UTC').subtract({ years: 1 });
        mostRecentUpdate = mostRecentUpdate.subtract({
            hours: this.#configuration.raceConditionCompensationHours,
        });

        const start = mostRecentUpdate.withTimeZone('UTC').round('seconds').toString({
            timeZoneName: 'never',
        });
        const end = Temporal.Now.zonedDateTimeISO('UTC').add({ minutes: 5 }).round('seconds')
            .toString({ timeZoneName: 'never' });

        this.log.info('[Orders] Fetching orders from the Weeztix API');
        this.log.info(`[Orders] w/ last updated = ${start}`);

        const recentOrdersMap = new Map<string, Order>();
        for (let page = 0; page < this.#configuration.maximumOrderPagesPerExecution; ++page) {
            if (page > 0 && this.#configuration.delayBetweenOrderPagesMs > 0) {
                await new Promise(resolve =>
                    setTimeout(resolve, this.#configuration.delayBetweenOrderPagesMs));
            }

            const batch = await this.#client.listOrders(companyGuid, {
                offset: page * this.#configuration.maximumOrdersPerPage,
                limit: this.#configuration.maximumOrdersPerPage,
                timeunit: 'year',
                range_applies_to: 'updated_at',
                start,
                end,
                sorting: { updated_at: 'asc' },
                events: [ eventGuid ],
            });

            for (const order of batch)
                recentOrdersMap.set(order.guid, order);

            if (batch.length < this.#configuration.maximumOrdersPerPage)
                break;
        }

        if (!recentOrdersMap.size) {
            this.log.warning('[Orders] No orders were returned by the API; skipping');
            return false;
        }

        this.log.info(`[Orders] Weeztix responded with ${recentOrdersMap.size} order(s)`);

        const liveOrders = new Map<string, LiveOrderEntry>();
        const liveTickets = new Map<string, LiveTicketEntry>();
        const livePurchases = new Map<string, LivePurchaseEntry>();

        for (const order of recentOrdersMap.values()) {
            liveOrders.set(order.guid, {
                guid: order.guid,
                name: order.fullname.replace(/\s+/g, ' ').trim() || null,
                status: order.status,
                created: parseTimestamp(order.created_at),
                updated: parseTimestamp(order.updated_at),
                deleted: order.invalidated_since ? parseTimestamp(order.invalidated_since) : null,
            });

            for (const ticket of order.tickets) {
                liveTickets.set(ticket.guid, {
                    guid: ticket.guid,
                    orderGuid: order.guid,
                    typeGuid: ticket.ticket_id,
                    barcode: ticket.ticket_number,
                    name: extractHolderName(ticket.meta_data),
                    nickname: extractNickname(ticket.meta_data),
                    price: Math.max(0, Math.round(ticket.finn_price - ticket.finn_service_fee)),
                    created: parseTimestamp(ticket.created_at),
                    updated: parseTimestamp(ticket.updated_at),
                    deleted:
                        ticket.invalidated_since ? parseTimestamp(ticket.invalidated_since) : null,
                });

                for (const product of ticket.products) {
                    livePurchases.set(
                        product.guid, toLivePurchaseEntry(product, order.guid, ticket.guid));
                }
            }

            for (const product of order.products) {
                if (!livePurchases.has(product.guid))
                    livePurchases.set(product.guid, toLivePurchaseEntry(product, order.guid, null));
            }
        }

        const orderGuids = [ ...liveOrders.keys() ];

        const dbInstance = db;
        const knownOrders = await dbInstance.selectFrom(tWeeztixOrders)
            .where(tWeeztixOrders.weeztixGuid.in(orderGuids))
            .select({
                guid: tWeeztixOrders.weeztixGuid,
                eventGuid: tWeeztixOrders.weeztixEventGuid,
                name: tWeeztixOrders.weeztixOrderName,
                status: tWeeztixOrders.weeztixOrderStatus,
                created: tWeeztixOrders.weeztixOrderCreated,
                updated: tWeeztixOrders.weeztixOrderUpdated,
                deleted: tWeeztixOrders.weeztixOrderDeleted,
            })
            .executeSelectMany();

        const knownTickets = await dbInstance.selectFrom(tWeeztixTickets)
            .where(tWeeztixTickets.weeztixOrderGuid.in(orderGuids))
            .select({
                guid: tWeeztixTickets.weeztixGuid,
                orderGuid: tWeeztixTickets.weeztixOrderGuid,
                eventGuid: tWeeztixTickets.weeztixEventGuid,
                typeGuid: tWeeztixTickets.weeztixTicketTypeGuid,
                barcode: tWeeztixTickets.weeztixTicketBarcode,
                name: tWeeztixTickets.weeztixTicketName,
                nickname: tWeeztixTickets.weeztixTicketMetaNickname,
                price: tWeeztixTickets.weeztixTicketPrice,
                created: tWeeztixTickets.weeztixTicketCreated,
                updated: tWeeztixTickets.weeztixTicketUpdated,
                deleted: tWeeztixTickets.weeztixTicketDeleted,
            })
            .executeSelectMany();

        const knownPurchases = await dbInstance.selectFrom(tWeeztixPurchases)
            .where(tWeeztixPurchases.weeztixOrderGuid.in(orderGuids))
            .select({
                guid: tWeeztixPurchases.weeztixGuid,
                ticketGuid: tWeeztixPurchases.weeztixTicketGuid,
                orderGuid: tWeeztixPurchases.weeztixOrderGuid,
                eventGuid: tWeeztixPurchases.weeztixEventGuid,
                typeGuid: tWeeztixPurchases.weeztixPurchaseTypeGuid,
                name: tWeeztixPurchases.weeztixPurchaseName,
                price: tWeeztixPurchases.weeztixPurchasePrice,
                created: tWeeztixPurchases.weeztixPurchaseCreated,
                updated: tWeeztixPurchases.weeztixPurchaseUpdated,
                deleted: tWeeztixPurchases.weeztixPurchaseDeleted,
            })
            .executeSelectMany();

        const knownOrdersMap = new Map(knownOrders.map(order => [ order.guid, order ]));
        const ordersToUpsert: LiveOrderEntry[] = [];

        let ordersAdded = 0;
        let ordersDeleted = 0;
        let ordersUpdated = 0;

        for (const liveOrder of liveOrders.values()) {
            const knownOrder = knownOrdersMap.get(liveOrder.guid);
            if (!knownOrder) {
                ordersToUpsert.push(liveOrder);
                ordersAdded++;
                continue;
            }

            const hasChanged =
                knownOrder.eventGuid !== eventGuid ||
                (knownOrder.name || null) !== liveOrder.name ||
                knownOrder.status !== liveOrder.status ||
                !areTimestampsEqual(knownOrder.created, liveOrder.created) ||
                !areTimestampsEqual(knownOrder.updated, liveOrder.updated) ||
                !areOptionalTimestampsEqual(knownOrder.deleted, liveOrder.deleted);

            if (hasChanged) {
                ordersToUpsert.push(liveOrder);
                if (!knownOrder.deleted && !!liveOrder.deleted)
                    ordersDeleted++;
                else
                    ordersUpdated++;
            }
        }

        const knownTicketsMap = new Map(knownTickets.map(ticket => [ ticket.guid, ticket ]));
        const ticketsToUpsert: LiveTicketEntry[] = [];
        const ticketGuidsToDelete: string[] = [];

        let ticketsAdded = 0;
        let ticketsDeleted = 0;
        let ticketsUpdated = 0;

        for (const liveTicket of liveTickets.values()) {
            const knownTicket = knownTicketsMap.get(liveTicket.guid);
            if (!knownTicket) {
                ticketsToUpsert.push(liveTicket);
                ticketsAdded++;
                continue;
            }

            const hasChanged =
                knownTicket.orderGuid !== liveTicket.orderGuid ||
                knownTicket.eventGuid !== eventGuid ||
                knownTicket.typeGuid !== liveTicket.typeGuid ||
                knownTicket.barcode !== liveTicket.barcode ||
                (knownTicket.name || null) !== liveTicket.name ||
                (knownTicket.nickname || null) !== liveTicket.nickname ||
                knownTicket.price !== liveTicket.price ||
                !areTimestampsEqual(knownTicket.created, liveTicket.created) ||
                !areTimestampsEqual(knownTicket.updated, liveTicket.updated) ||
                !areOptionalTimestampsEqual(knownTicket.deleted, liveTicket.deleted);

            if (hasChanged) {
                ticketsToUpsert.push(liveTicket);
                if (!knownTicket.deleted && !!liveTicket.deleted)
                    ticketsDeleted++;
                else
                    ticketsUpdated++;
            }
        }

        for (const knownTicket of knownTickets) {
            if (!!knownTicket.deleted || liveTickets.has(knownTicket.guid))
                continue;

            ticketGuidsToDelete.push(knownTicket.guid);
            ticketsDeleted++;
        }

        const knownPurchasesMap =
            new Map(knownPurchases.map(purchase => [ purchase.guid, purchase ]));
        const purchasesToUpsert: LivePurchaseEntry[] = [];
        const purchaseGuidsToDelete: string[] = [];

        let purchasesAdded = 0;
        let purchasesDeleted = 0;
        let purchasesUpdated = 0;

        for (const livePurchase of livePurchases.values()) {
            const knownPurchase = knownPurchasesMap.get(livePurchase.guid);
            if (!knownPurchase) {
                purchasesToUpsert.push(livePurchase);
                purchasesAdded++;
                continue;
            }

            const hasChanged =
                (knownPurchase.ticketGuid || null) !== livePurchase.ticketGuid ||
                knownPurchase.orderGuid !== livePurchase.orderGuid ||
                knownPurchase.eventGuid !== eventGuid ||
                knownPurchase.typeGuid !== livePurchase.typeGuid ||
                (knownPurchase.name || null) !== livePurchase.name ||
                knownPurchase.price !== livePurchase.price ||
                !areTimestampsEqual(knownPurchase.created, livePurchase.created) ||
                !areTimestampsEqual(knownPurchase.updated, livePurchase.updated) ||
                !areOptionalTimestampsEqual(knownPurchase.deleted, livePurchase.deleted);

            if (hasChanged) {
                purchasesToUpsert.push(livePurchase);
                if (!knownPurchase.deleted && !!livePurchase.deleted)
                    purchasesDeleted++;
                else
                    purchasesUpdated++;
            }
        }

        for (const knownPurchase of knownPurchases) {
            if (!!knownPurchase.deleted || livePurchases.has(knownPurchase.guid))
                continue;

            purchaseGuidsToDelete.push(knownPurchase.guid);
            purchasesDeleted++;
        }

        const hasDatabaseChanges =
            ordersToUpsert.length > 0 ||
            ticketsToUpsert.length > 0 ||
            ticketGuidsToDelete.length > 0 ||
            purchasesToUpsert.length > 0 ||
            purchaseGuidsToDelete.length > 0;

        if (hasDatabaseChanges) {
            await dbInstance.transaction(async () => {
                for (const entry of ordersToUpsert) {
                    const values = {
                        weeztixEventGuid: eventGuid,
                        weeztixOrderName: entry.name,
                        weeztixOrderStatus: entry.status,
                        weeztixOrderCreated: entry.created,
                        weeztixOrderUpdated: entry.updated,
                        weeztixOrderDeleted: entry.deleted,
                    };

                    await dbInstance.insertInto(tWeeztixOrders)
                        .set({
                            weeztixGuid: entry.guid,
                            ...values,
                        })
                        .onConflictDoUpdateSet(values)
                        .executeInsert();
                }

                for (const entry of ticketsToUpsert) {
                    const values = {
                        weeztixOrderGuid: entry.orderGuid,
                        weeztixEventGuid: eventGuid,
                        weeztixTicketTypeGuid: entry.typeGuid,
                        weeztixTicketBarcode: entry.barcode,
                        weeztixTicketName: entry.name,
                        weeztixTicketMetaNickname: entry.nickname,
                        weeztixTicketPrice: entry.price,
                        weeztixTicketCreated: entry.created,
                        weeztixTicketUpdated: entry.updated,
                        weeztixTicketDeleted: entry.deleted,
                    };

                    await dbInstance.insertInto(tWeeztixTickets)
                        .set({
                            weeztixGuid: entry.guid,
                            ...values,
                        })
                        .onConflictDoUpdateSet(values)
                        .executeInsert();
                }

                if (ticketGuidsToDelete.length > 0) {
                    await dbInstance.update(tWeeztixTickets)
                        .set({
                            weeztixTicketDeleted: dbInstance.currentZonedDateTime(),
                        })
                        .where(tWeeztixTickets.weeztixOrderGuid.in(orderGuids))
                            .and(tWeeztixTickets.weeztixGuid.in(ticketGuidsToDelete))
                            .and(tWeeztixTickets.weeztixTicketDeleted.isNull())
                        .executeUpdate();
                }

                for (const entry of purchasesToUpsert) {
                    const values = {
                        weeztixTicketGuid: entry.ticketGuid,
                        weeztixOrderGuid: entry.orderGuid,
                        weeztixEventGuid: eventGuid,
                        weeztixPurchaseTypeGuid: entry.typeGuid,
                        weeztixPurchaseName: entry.name,
                        weeztixPurchasePrice: entry.price,
                        weeztixPurchaseCreated: entry.created,
                        weeztixPurchaseUpdated: entry.updated,
                        weeztixPurchaseDeleted: entry.deleted,
                    };

                    await dbInstance.insertInto(tWeeztixPurchases)
                        .set({
                            weeztixGuid: entry.guid,
                            ...values,
                        })
                        .onConflictDoUpdateSet(values)
                        .executeInsert();
                }

                if (purchaseGuidsToDelete.length > 0) {
                    await dbInstance.update(tWeeztixPurchases)
                        .set({
                            weeztixPurchaseDeleted: dbInstance.currentZonedDateTime(),
                        })
                        .where(tWeeztixPurchases.weeztixOrderGuid.in(orderGuids))
                            .and(tWeeztixPurchases.weeztixGuid.in(purchaseGuidsToDelete))
                            .and(tWeeztixPurchases.weeztixPurchaseDeleted.isNull())
                        .executeUpdate();
                }
            });
        }

        this.log.info(
            `[Orders] Added: ${ordersAdded}, updated: ${ordersUpdated}, deleted: ${ordersDeleted}`);
        this.log.info(
            `[Orders] Tickets — added: ${ticketsAdded}, updated: ${ticketsUpdated}, ` +
            `deleted: ${ticketsDeleted}`);
        this.log.info(
            `[Orders] Purchases — added: ${purchasesAdded}, updated: ${purchasesUpdated}, ` +
            `deleted: ${purchasesDeleted}`);

        return true;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Updates the task interval for |this| task based on how close we are to the `endTime` of the
     * festival it's running for.
     *
     * @param endTime Time at which the festival is expected to end.
     */
    private updateTaskIntervalForFestivalDate(endTime: Temporal.ZonedDateTime): void {
        const configuration = WeeztixImportTask.kIntervalConfiguration;
        const maximumInterval = WeeztixImportTask.kIntervalMaximum;

        const differenceInDays = endTime.since(Temporal.Now.zonedDateTimeISO('UTC'), {
            largestUnit: 'days',
        }).days;

        if (differenceInDays < 0) {
            this.log.debug('[Interval] The event happened in the past, using maximum value.');
            this.setIntervalForRepeatingTask(maximumInterval);
            return;
        }

        for (const { maximumDays, intervalMs } of configuration) {
            if (differenceInDays > maximumDays)
                continue;

            this.log.info(`[Interval] Updating to ${intervalMs}ms (days=${differenceInDays})`);
            this.setIntervalForRepeatingTask(intervalMs);
            return;
        }

        this.log.info('[Interval] The event is still very far out, using maximum interval.');
        this.setIntervalForRepeatingTask(maximumInterval);
    }
}
