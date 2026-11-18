// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GetOrderResponse, Order } from '@lib/integrations/weeztix/WeeztixTypes';
import type { WeeztixClient } from '@lib/integrations/weeztix';
import type { WeeztixTicketType } from '@lib/database/Types';
import { FinanceProcessor } from '@app/admin/events/[event]/finance/FinanceProcessor';
import { Task } from '../Task';
import { TaskContext } from '../TaskContext';
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
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    created: Temporal.ZonedDateTime;
    updated: Temporal.ZonedDateTime;
    deleted: Temporal.ZonedDateTime | null;
    manualUpdate: boolean;
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
    metaFunction: string | null;
    metaNickname: string | null;
    metaOrganisation: string | null;
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
 * Extracted metadata fields from a Weeztix ticket's `meta_data` array.
 */
interface ExtractedTicketMetadata {
    metaFunction: string | null;
    metaNickname: string | null;
    metaOrganisation: string | null;
}

/**
 * Minimal metadata entry shape accepted by metadata extraction helpers.
 */
interface MetadataEntry {
    metadata_id: string;
    value?: string | number | boolean | null;
}

/**
 * Parses an ISO 8601 timestamp string into a UTC `Temporal.ZonedDateTime` rounded to whole seconds.
 */
function parseTimestamp(value: string): Temporal.ZonedDateTime {
    return Temporal.Instant.from(value).round('seconds').toZonedDateTimeISO('UTC');
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

    /**
     * Executes a one-off import of the given `orderGuid` in context of `eventGuid`. The order is
     * flagged as manually updated so it does not advance the periodic sync watermark.
     */
    static async importOrder(
        eventGuid: string, orderGuid: string, context?: TaskContext): Promise<boolean>
    {
        const taskContext = context ?? TaskContext.forEphemeralTask('WeeztixImportTask', null);
        const task = new WeeztixImportTask(taskContext);
        await task.initialise();

        return task.importSingleOrder(eventGuid, orderGuid);
    }

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
                    .and(tWeeztixOrders.weeztixOrderManualUpdate.equals(/* false= */ 0))
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
                    eventId: tEvents.eventWeeztixGuid,
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
            if (!event.context?.eventId)
                throw new Error(`Unable to update ${event.name} data without an event GUID`);

            this.log.info(`Starting data import for ${event.name}`);

            await this.importProductsAndTickets(event.context.eventId);
            await this.importOrders(event.context.eventId, event.mostRecentUpdate);

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
     * Method to import the latest orders for the given `eventGuid` that were updated after the
     * given `mostRecentUpdate`.
     */
    private async importOrders(
        eventGuid: string, mostRecentUpdate?: Temporal.ZonedDateTime): Promise<boolean>
    {
        const recentOrdersMap = await this.fetchRecentOrders(eventGuid, mostRecentUpdate);

        if (!recentOrdersMap.size) {
            this.log.warning('[Orders] No orders were returned by the API; skipping');
            return false;
        }

        this.log.info(`[Orders] Weeztix responded with ${recentOrdersMap.size} order(s)`);

        return this.syncOrders(eventGuid, this.extractLiveEntities(recentOrdersMap));
    }

    /**
     * Fetches and synchronises a single order identified by `orderGuid` for `eventGuid` as a
     * manual one-off update.
     */
    private async importSingleOrder(eventGuid: string, orderGuid: string): Promise<boolean> {
        this.log.info(`[Orders] Fetching order ${orderGuid} from the Weeztix API`);

        const order = await this.#client.getOrder(orderGuid);
        const entities = this.extractSingleOrderEntities(order);
        if (!entities) {
            this.log.error(`[Orders] Order ${orderGuid} is missing required fields for import`);
            return false;
        }

        return this.syncOrders(eventGuid, entities, /* preserveUtm= */ true);
    }

    /**
     * Diffs and persists the given normalised `entities` for `eventGuid` into the Weeztix tables.
     */
    private async syncOrders(
        eventGuid: string,
        entities: {
            liveOrders: Map<string, LiveOrderEntry>;
            liveTickets: Map<string, LiveTicketEntry>;
            livePurchases: Map<string, LivePurchaseEntry>;
        },
        preserveUtm: boolean = false): Promise<boolean>
    {
        const { liveOrders, liveTickets, livePurchases } = entities;

        const orderGuids = [ ...liveOrders.keys() ];
        const dbInstance = db;

        const [ knownOrders, knownTickets, knownPurchases ] = await Promise.all([
            dbInstance.selectFrom(tWeeztixOrders)
                .where(tWeeztixOrders.weeztixGuid.in(orderGuids))
                .select({
                    guid: tWeeztixOrders.weeztixGuid,
                    eventGuid: tWeeztixOrders.weeztixEventGuid,
                    name: tWeeztixOrders.weeztixOrderName,
                    status: tWeeztixOrders.weeztixOrderStatus,
                    utmSource: tWeeztixOrders.weeztixOrderUtmSource,
                    utmMedium: tWeeztixOrders.weeztixOrderUtmMedium,
                    utmCampaign: tWeeztixOrders.weeztixOrderUtmCampaign,
                    utmTerm: tWeeztixOrders.weeztixOrderUtmTerm,
                    created: tWeeztixOrders.weeztixOrderCreated,
                    updated: tWeeztixOrders.weeztixOrderUpdated,
                    deleted: tWeeztixOrders.weeztixOrderDeleted,
                    manualUpdate: tWeeztixOrders.weeztixOrderManualUpdate.equals(/* true= */ 1),
                })
                .executeSelectMany(),
            dbInstance.selectFrom(tWeeztixTickets)
                .where(tWeeztixTickets.weeztixOrderGuid.in(orderGuids))
                .select({
                    guid: tWeeztixTickets.weeztixGuid,
                    orderGuid: tWeeztixTickets.weeztixOrderGuid,
                    eventGuid: tWeeztixTickets.weeztixEventGuid,
                    typeGuid: tWeeztixTickets.weeztixTicketTypeGuid,
                    barcode: tWeeztixTickets.weeztixTicketBarcode,
                    name: tWeeztixTickets.weeztixTicketName,
                    metaFunction: tWeeztixTickets.weeztixTicketMetaFunction,
                    metaNickname: tWeeztixTickets.weeztixTicketMetaNickname,
                    metaOrganisation: tWeeztixTickets.weeztixTicketMetaOrganisation,
                    price: tWeeztixTickets.weeztixTicketPrice,
                    created: tWeeztixTickets.weeztixTicketCreated,
                    updated: tWeeztixTickets.weeztixTicketUpdated,
                    deleted: tWeeztixTickets.weeztixTicketDeleted,
                })
                .executeSelectMany(),
            dbInstance.selectFrom(tWeeztixPurchases)
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
                .executeSelectMany(),
        ]);

        // `GET /order/:guid` does not return `tech_data`, so retain existing UTM attribution on
        // one-off imports rather than overwriting it with NULL.
        if (preserveUtm) {
            for (const known of knownOrders) {
                const live = liveOrders.get(known.guid);
                if (!live)
                    continue;

                live.utmSource = known.utmSource || null;
                live.utmMedium = known.utmMedium || null;
                live.utmCampaign = known.utmCampaign || null;
                live.utmTerm = known.utmTerm || null;
            }
        }

        const ordersDiff = this.diffWeeztixEntities(
            knownOrders, liveOrders, false,
            (known, live) =>
                known.eventGuid !== eventGuid ||
                (known.name || null) !== live.name ||
                known.status !== live.status ||
                (known.utmSource || null) !== live.utmSource ||
                (known.utmMedium || null) !== live.utmMedium ||
                (known.utmCampaign || null) !== live.utmCampaign ||
                (known.utmTerm || null) !== live.utmTerm ||
                !areTimestampsEqual(known.created, live.created) ||
                !areTimestampsEqual(known.updated, live.updated) ||
                !areOptionalTimestampsEqual(known.deleted, live.deleted) ||
                known.manualUpdate !== live.manualUpdate);

        const ticketsDiff = this.diffWeeztixEntities(
            knownTickets, liveTickets, true,
            (known, live) =>
                known.orderGuid !== live.orderGuid ||
                known.eventGuid !== eventGuid ||
                known.typeGuid !== live.typeGuid ||
                known.barcode !== live.barcode ||
                (known.name || null) !== live.name ||
                (known.metaFunction || null) !== live.metaFunction ||
                (known.metaNickname || null) !== live.metaNickname ||
                (known.metaOrganisation || null) !== live.metaOrganisation ||
                known.price !== live.price ||
                !areTimestampsEqual(known.created, live.created) ||
                !areTimestampsEqual(known.updated, live.updated) ||
                !areOptionalTimestampsEqual(known.deleted, live.deleted));

        const purchasesDiff = this.diffWeeztixEntities(
            knownPurchases, livePurchases, true,
            (known, live) =>
                (known.ticketGuid || null) !== live.ticketGuid ||
                known.orderGuid !== live.orderGuid ||
                known.eventGuid !== eventGuid ||
                known.typeGuid !== live.typeGuid ||
                (known.name || null) !== live.name ||
                known.price !== live.price ||
                !areTimestampsEqual(known.created, live.created) ||
                !areTimestampsEqual(known.updated, live.updated) ||
                !areOptionalTimestampsEqual(known.deleted, live.deleted));

        await this.persistOrderChanges(dbInstance, eventGuid, orderGuids, {
            ordersToUpsert: ordersDiff.toUpsert,
            ticketsToUpsert: ticketsDiff.toUpsert,
            ticketGuidsToDelete: ticketsDiff.guidsToDelete,
            purchasesToUpsert: purchasesDiff.toUpsert,
            purchaseGuidsToDelete: purchasesDiff.guidsToDelete,
        });

        this.log.info(
            `[Orders] Added: ${ordersDiff.added}, updated: ${ordersDiff.updated}, ` +
            `deleted: ${ordersDiff.deleted}`);
        this.log.info(
            `[Orders] Tickets — added: ${ticketsDiff.added}, updated: ${ticketsDiff.updated}, ` +
            `deleted: ${ticketsDiff.deleted}`);
        this.log.info(
            `[Orders] Purchases — added: ${purchasesDiff.added}, ` +
            `updated: ${purchasesDiff.updated}, deleted: ${purchasesDiff.deleted}`);

        return true;
    }

    /**
     * Fetches paginated orders from the Weeztix API updated since `mostRecentUpdate`.
     */
    private async fetchRecentOrders(
        eventGuid: string, mostRecentUpdate?: Temporal.ZonedDateTime): Promise<Map<string, Order>>
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

            const batch = await this.#client.listOrders({
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

        return recentOrdersMap;
    }

    /**
     * Normalises API orders into separate maps of live orders, tickets, and purchases.
     */
    private extractLiveEntities(recentOrdersMap: Map<string, Order>) {
        const liveOrders = new Map<string, LiveOrderEntry>();
        const liveTickets = new Map<string, LiveTicketEntry>();
        const livePurchases = new Map<string, LivePurchaseEntry>();

        for (const order of recentOrdersMap.values()) {
            liveOrders.set(order.guid, {
                guid: order.guid,
                name: order.fullname.replace(/\s+/g, ' ').trim() || null,
                status: order.status,
                utmSource: order.tech_data.utm_source?.trim() || null,
                utmMedium: order.tech_data.utm_medium?.trim() || null,
                utmCampaign: order.tech_data.utm_campaign?.trim() || null,
                utmTerm: order.tech_data.utm_term?.trim() || null,
                created: parseTimestamp(order.created_at),
                updated: parseTimestamp(order.updated_at),
                deleted: order.invalidated_since ? parseTimestamp(order.invalidated_since) : null,
                manualUpdate: false,
            });

            for (const ticket of order.tickets) {
                liveTickets.set(ticket.guid, {
                    guid: ticket.guid,
                    orderGuid: order.guid,
                    typeGuid: ticket.ticket_id,
                    barcode: ticket.ticket_number,
                    name: this.extractHolderName(ticket.meta_data),
                    ...this.extractTicketMetadata(ticket.meta_data),
                    price: Math.max(0, Math.round(ticket.finn_price - ticket.finn_service_fee)),
                    created: parseTimestamp(ticket.created_at),
                    updated: parseTimestamp(ticket.updated_at),
                    deleted:
                        ticket.invalidated_since ? parseTimestamp(ticket.invalidated_since) : null,
                });

                for (const product of ticket.products) {
                    livePurchases.set(
                        product.guid,
                        this.toLivePurchaseEntry(product, order.guid, ticket.guid));
                }
            }

            for (const product of order.products) {
                if (!livePurchases.has(product.guid)) {
                    livePurchases.set(
                        product.guid, this.toLivePurchaseEntry(product, order.guid, null));
                }
            }
        }

        return { liveOrders, liveTickets, livePurchases };
    }

    /**
     * Normalises a single `GET /order/:guid` response into live order, ticket, and purchase maps
     * flagged as a manual update, returning `undefined` when required fields are absent.
     */
    private extractSingleOrderEntities(order: GetOrderResponse) {
        if (!order.status || !order.created_at)
            return undefined;

        const orderCreated = parseTimestamp(order.created_at);
        const orderUpdated = order.updated_at ? parseTimestamp(order.updated_at) : orderCreated;

        const liveOrders = new Map<string, LiveOrderEntry>([[ order.guid, {
            guid: order.guid,
            name: (order.fullname ?? '').replace(/\s+/g, ' ').trim() || null,
            status: order.status,
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmTerm: null,
            created: orderCreated,
            updated: orderUpdated,
            deleted: order.invalidated_since ? parseTimestamp(order.invalidated_since) : null,
            manualUpdate: true,
        } ]]);
        const liveTickets = new Map<string, LiveTicketEntry>();
        const livePurchases = new Map<string, LivePurchaseEntry>();

        for (const ticket of order.tickets ?? []) {
            if (!ticket.ticket?.guid)
                return undefined;

            const created = ticket.created_at ? parseTimestamp(ticket.created_at) : orderCreated;
            const metadata = ticket.meta_data ?? [];
            liveTickets.set(ticket.guid, {
                guid: ticket.guid,
                orderGuid: order.guid,
                typeGuid: ticket.ticket.guid,
                barcode: ticket.ticket_number ?? '',
                name: this.extractHolderName(metadata),
                ...this.extractTicketMetadata(metadata),
                price: Math.max(
                    0, Math.round((ticket.finn_price ?? 0) - (ticket.finn_service_fee ?? 0))),
                created,
                updated: ticket.updated_at ? parseTimestamp(ticket.updated_at) : created,
                deleted: ticket.invalidated_since ? parseTimestamp(ticket.invalidated_since) : null,
            });

            for (const product of ticket.products ?? []) {
                const entry = this.toSingleOrderPurchaseEntry(
                    product, order.guid, ticket.guid, orderCreated);
                if (!entry)
                    return undefined;

                livePurchases.set(product.guid, entry);
            }
        }

        for (const product of order.products ?? []) {
            if (livePurchases.has(product.guid))
                continue;

            const entry = this.toSingleOrderPurchaseEntry(product, order.guid, null, orderCreated);
            if (!entry)
                return undefined;

            livePurchases.set(product.guid, entry);
        }

        return { liveOrders, liveTickets, livePurchases };
    }

    /**
     * Extracts the personalised holder name (`first_name` and `last_name`) from ticket or purchase
     * `metadata`, returning `null` when neither is present.
     */
    private extractHolderName(metadata: readonly MetadataEntry[]): string | null {
        let firstName: string | undefined;
        let lastName: string | undefined;

        for (const entry of metadata) {
            if (entry.value === null || entry.value === undefined ||
                typeof entry.value === 'boolean')
            {
                continue;
            }

            if (entry.metadata_id === this.#client.metaFirstNameId)
                firstName = String(entry.value);
            else if (entry.metadata_id === this.#client.metaLastNameId)
                lastName = String(entry.value);
        }

        return [ firstName, lastName ]
            .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;
    }

    /**
     * Extracts known metadata fields from ticket `metadata` by matching `metadata_id` against the
     * GUIDs configured on `this.#client`, returning `null` when absent.
     */
    private extractTicketMetadata(metadata: readonly MetadataEntry[]): ExtractedTicketMetadata {
        const result: ExtractedTicketMetadata = {
            metaFunction: null,
            metaNickname: null,
            metaOrganisation: null,
        };

        const fieldMapping: [ keyof ExtractedTicketMetadata, string ][] = [
            [ 'metaFunction', this.#client.metaFunctionId ],
            [ 'metaNickname', this.#client.metaNicknameId ],
            [ 'metaOrganisation', this.#client.metaOrganisationId ],
        ];

        for (const entry of metadata) {
            if (entry.value === null || entry.value === undefined ||
                typeof entry.value === 'boolean')
            {
                continue;
            }

            for (const [ key, metadataId ] of fieldMapping) {
                if (result[key] !== null || entry.metadata_id !== metadataId)
                    continue;

                const value = String(entry.value).replace(/\s+/g, ' ').trim();
                if (value)
                    result[key] = value;
            }
        }

        return result;
    }

    /**
     * Normalises a Weeztix `product` entry into a `LivePurchaseEntry` associated with `orderGuid`
     * and optionally `ticketGuid`.
     */
    private toLivePurchaseEntry(
        product: Order['products'][number], orderGuid: string, ticketGuid: string | null)
            : LivePurchaseEntry
    {
        return {
            guid: product.guid,
            ticketGuid,
            orderGuid,
            typeGuid: product.product_id,
            name: this.extractHolderName(product.meta_data),
            price: Math.max(0, Math.round(product.finn_price - product.finn_service_fee)),
            created: parseTimestamp(product.created_at),
            updated: parseTimestamp(product.updated_at),
            deleted: product.invalidated_since ? parseTimestamp(product.invalidated_since) : null,
        };
    }

    /**
     * Normalises a product returned by `GET /order/:guid` into a `LivePurchaseEntry`, returning
     * `undefined` when its product type GUID is absent.
     */
    private toSingleOrderPurchaseEntry(
        product: NonNullable<GetOrderResponse['products']>[number],
        orderGuid: string,
        ticketGuid: string | null,
        fallbackCreated: Temporal.ZonedDateTime): LivePurchaseEntry | undefined
    {
        if (!product.product?.guid)
            return undefined;

        const created = product.created_at ? parseTimestamp(product.created_at) : fallbackCreated;
        return {
            guid: product.guid,
            ticketGuid,
            orderGuid,
            typeGuid: product.product.guid,
            name: this.extractHolderName(product.meta_data ?? []),
            price: Math.max(
                0, Math.round((product.finn_price ?? 0) - (product.finn_service_fee ?? 0))),
            created,
            updated: product.updated_at ? parseTimestamp(product.updated_at) : created,
            deleted: product.invalidated_since ? parseTimestamp(product.invalidated_since) : null,
        };
    }

    /**
     * Computes additions, updates, and soft-deletions between stored and live Weeztix entities.
     */
    private diffWeeztixEntities<
        TKnown extends { guid: string; deleted?: Temporal.ZonedDateTime | null },
        TLive extends { guid: string; deleted: Temporal.ZonedDateTime | null },
    >(
        knownItems: TKnown[],
        liveMap: Map<string, TLive>,
        trackOrphans: boolean,
        hasChanged: (known: TKnown, live: TLive) => boolean,
    ) {
        const knownMap = new Map(knownItems.map(item => [ item.guid, item ]));
        const toUpsert: TLive[] = [];
        const guidsToDelete: string[] = [];

        let added = 0;
        let deleted = 0;
        let updated = 0;

        for (const live of liveMap.values()) {
            const known = knownMap.get(live.guid);
            if (!known) {
                toUpsert.push(live);
                added++;
                continue;
            }

            if (hasChanged(known, live)) {
                toUpsert.push(live);
                if (!known.deleted && !!live.deleted)
                    deleted++;
                else
                    updated++;
            }
        }

        if (trackOrphans) {
            for (const known of knownItems) {
                if (!!known.deleted || liveMap.has(known.guid))
                    continue;

                guidsToDelete.push(known.guid);
                deleted++;
            }
        }

        return { toUpsert, guidsToDelete, added, deleted, updated };
    }

    /**
     * Persists order, ticket, and purchase upserts and soft-deletions in a single transaction.
     */
    private async persistOrderChanges(
        dbInstance: typeof db,
        eventGuid: string,
        orderGuids: string[],
        changes: {
            ordersToUpsert: LiveOrderEntry[];
            ticketsToUpsert: LiveTicketEntry[];
            ticketGuidsToDelete: string[];
            purchasesToUpsert: LivePurchaseEntry[];
            purchaseGuidsToDelete: string[];
        },
    ): Promise<void> {
        const hasDatabaseChanges =
            changes.ordersToUpsert.length > 0 ||
            changes.ticketsToUpsert.length > 0 ||
            changes.ticketGuidsToDelete.length > 0 ||
            changes.purchasesToUpsert.length > 0 ||
            changes.purchaseGuidsToDelete.length > 0;

        if (!hasDatabaseChanges)
            return;

        await dbInstance.transaction(async () => {
            for (const entry of changes.ordersToUpsert) {
                const values = {
                    weeztixEventGuid: eventGuid,
                    weeztixOrderName: entry.name,
                    weeztixOrderStatus: entry.status,
                    weeztixOrderUtmSource: entry.utmSource,
                    weeztixOrderUtmMedium: entry.utmMedium,
                    weeztixOrderUtmCampaign: entry.utmCampaign,
                    weeztixOrderUtmTerm: entry.utmTerm,
                    weeztixOrderCreated: entry.created,
                    weeztixOrderUpdated: entry.updated,
                    weeztixOrderDeleted: entry.deleted,
                    weeztixOrderManualUpdate: entry.manualUpdate ? 1 : 0,
                };

                await dbInstance.insertInto(tWeeztixOrders)
                    .set({ weeztixGuid: entry.guid, ...values })
                    .onConflictDoUpdateSet(values)
                    .executeInsert();
            }

            for (const entry of changes.ticketsToUpsert) {
                const values = {
                    weeztixOrderGuid: entry.orderGuid,
                    weeztixEventGuid: eventGuid,
                    weeztixTicketTypeGuid: entry.typeGuid,
                    weeztixTicketBarcode: entry.barcode,
                    weeztixTicketName: entry.name,
                    weeztixTicketMetaFunction: entry.metaFunction,
                    weeztixTicketMetaNickname: entry.metaNickname,
                    weeztixTicketMetaOrganisation: entry.metaOrganisation,
                    weeztixTicketPrice: entry.price,
                    weeztixTicketCreated: entry.created,
                    weeztixTicketUpdated: entry.updated,
                    weeztixTicketDeleted: entry.deleted,
                };

                await dbInstance.insertInto(tWeeztixTickets)
                    .set({ weeztixGuid: entry.guid, ...values })
                    .onConflictDoUpdateSet(values)
                    .executeInsert();
            }

            if (changes.ticketGuidsToDelete.length > 0) {
                await dbInstance.update(tWeeztixTickets)
                    .set({ weeztixTicketDeleted: dbInstance.currentZonedDateTime() })
                    .where(tWeeztixTickets.weeztixOrderGuid.in(orderGuids))
                        .and(tWeeztixTickets.weeztixGuid.in(changes.ticketGuidsToDelete))
                        .and(tWeeztixTickets.weeztixTicketDeleted.isNull())
                    .executeUpdate();
            }

            for (const entry of changes.purchasesToUpsert) {
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
                    .set({ weeztixGuid: entry.guid, ...values })
                    .onConflictDoUpdateSet(values)
                    .executeInsert();
            }

            if (changes.purchaseGuidsToDelete.length > 0) {
                await dbInstance.update(tWeeztixPurchases)
                    .set({ weeztixPurchaseDeleted: dbInstance.currentZonedDateTime() })
                    .where(tWeeztixPurchases.weeztixOrderGuid.in(orderGuids))
                        .and(tWeeztixPurchases.weeztixGuid.in(changes.purchaseGuidsToDelete))
                        .and(tWeeztixPurchases.weeztixPurchaseDeleted.isNull())
                    .executeUpdate();
            }
        });
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
