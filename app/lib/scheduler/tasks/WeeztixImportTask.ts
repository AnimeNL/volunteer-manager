// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { WeeztixClient } from '@lib/integrations/weeztix';
import type { WeeztixTicketType } from '@lib/database/Types';
import { Task } from '../Task';
import { createWeeztixClient } from '@lib/integrations/weeztix';
import db, { tEvents, tWeeztixTicketTypes } from '@lib/database';

import { kWeeztixTicketType } from '@lib/database/Types';

/**
 * Configuration options available for the `WeeztixImportTask` mechanism.
 */
interface WeeztixImportTaskConfiguration {
    /**
     * Number of milliseconds of delay to impose between importing multiple orders.
     */
    delayBetweenOrderImportsMs: number;

    /**
     * Maximum number of orders to import per execution of this task. Importing orders issues an
     * additional API call per order to the Weeztix API, so we want to be careful.
     */
    maximumOrderImportsPerExecution: number;

    /**
     * Maximum number of orders to retrieve from the statistics endpoint per execution.
     */
    maximumOrdersConsideredPerExecution: number;

    /**
     * Number of hours to subtract from the most recent update to compensate for race conditions in
     * the update process, i.e. failures or overlapping requests.
     */
    raceConditionCompensationHours: number;
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
 * Returns whether `lhs` and `rhs` represent the same instant at second precision.
 */
function areTimestampsEqual(lhs: Temporal.ZonedDateTime, rhs: Temporal.ZonedDateTime): boolean {
    return Temporal.ZonedDateTime.compare(lhs.round('seconds'), rhs.round('seconds')) === 0;
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
            delayBetweenOrderImportsMs: 1000,
            maximumOrderImportsPerExecution: 0,  // disabled until order tables exist
            maximumOrdersConsideredPerExecution: 100,
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
                // TODO: Select `mostRecentUpdate` from `weeztix_orders` once the table exists.
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

            if (this.#configuration.maximumOrderImportsPerExecution > 0) {
                await this.importOrders(
                    event.context.companyGuid, event.context.eventGuid,
                    /* mostRecentUpdate= */ undefined);
            }

            // TODO: Revalidate `FinanceProcessor` once order tables exist.
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

        const recentOrders = await this.#client.listOrders(companyGuid, {
            offset: 0,
            limit: this.#configuration.maximumOrdersConsideredPerExecution,
            timeunit: 'year',
            range_applies_to: 'updated_at',
            start,
            end,
            sorting: { updated_at: 'desc' },
            events: [ eventGuid ],
        });

        if (!recentOrders.length) {
            this.log.warning('[Orders] No orders were returned by the API; skipping');
            return false;
        }

        this.log.info(`[Orders] Weeztix responded with ${recentOrders.length} order(s)`);

        // TODO: Import the actual order(s).

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
