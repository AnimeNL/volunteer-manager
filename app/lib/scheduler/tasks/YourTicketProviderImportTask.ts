// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { YourTicketProviderClient } from '@lib/integrations/yourticketprovider/YourTicketProviderClient';
import { Task } from '../Task';
import { TaskContext } from '../TaskContext';
import { createYourTicketProviderClient } from '@lib/integrations/yourticketprovider';
import db, { tEvents, tYourTicketProviderPurchases, tYourTicketProviderTickets } from '@lib/database';

/**
 * Configuration options available for the `YourTicketProviderImportTask` mechanism.
 */
interface YourTicketProviderImportTaskConfiguration {
    /**
     * Number of milliseconds of delay to impose between importing multiple purchases.
     */
    delayBetweenPurchaseImportsMs: number;

    /**
     * Maximum number of purchases to import per execution of this task. Importing purchases issues
     * up to 2n+1 API calls to the YourTicketProvider API, so we want to be careful.
     */
    maximumPurchasesPerExecution: number;
}

/**
 * Information already known about tickets for a particular event.
 */
interface KnownTicketInformation {
    id: number;

    Name: string;
    Price: number;
    Amount: number;
    SoldOut: boolean;
    Live: boolean;
    IsSubProduct: boolean;
    SalesStart?: Temporal.ZonedDateTime;
    SalesEnd?: Temporal.ZonedDateTime;
    Updated: Temporal.ZonedDateTime;
}

/**
 * Returns whether the |lhs| and |rhs| represent different `ZonedDateTime` instances.
 */
function ZonedDateTimesAreDifferent(lhs?: Temporal.ZonedDateTime, rhs?: Temporal.ZonedDateTime) {
    if (!!lhs !== !!rhs)
        return true;  // one holds a value, the other does not

    if (!lhs || !rhs)
        return false;  // neither holds a value

    return Temporal.ZonedDateTime.compare(lhs.round('seconds'), rhs.round('seconds')) !== 0;
}

/**
 * Task that periodically imports information from YourTicketProvider.
 *
 * There are two specific data points that will be synchronised by this task. First, the ticket
 * types that exist for each live event, and second, metadata associated with each of the individual
 * purchased items. All stored data is expected to be anonimised after the event concludes, and the
 * strict operational need to keep a copy ceases to be relevant.
 */
export class YourTicketProviderImportTask extends Task {
    /**
     * The default interval for the import task, when no precise granularity can be decided upon.
     */
    static readonly kIntervalMaximum = /* 12 hours= */ 12 * 3600 * 1000;

    /**
     * Intervals for the tasks based on the number of days until the event happens.
     */
    static readonly kIntervalConfiguration = [
        { maximumDays: /*  2 weeks= */   14, intervalMs: /* 1 hour= */      3600 * 1000 },
        { maximumDays: /*  4 weeks= */   28, intervalMs: /* 3 hours= */ 3 * 3600 * 1000 },
        { maximumDays: /* 12 weeks= */   56, intervalMs: /* 6 hours= */ 6 * 3600 * 1000 },
    ];

    /**
     * Executes a one-off import of the given `purchaseId` in context of the given `eventId`. This
     * will issue two API calls to the YourTicketProvider API.
     */
    static async importPurchase(eventId: number, purchaseId: number): Promise<boolean> {
        const taskContext = TaskContext.forEphemeralTask('YourTicketProviderImportTask', null);
        const task = new YourTicketProviderImportTask(taskContext);
        await task.initialise();

        return task.importIndividualPurchase(eventId, purchaseId);
    }

    #client: YourTicketProviderClient = undefined!;
    #configuration: YourTicketProviderImportTaskConfiguration = undefined!;

    /**
     * Initialises the `YourTicketProviderImportTask` infrastructure.
     */
    private async initialise(): Promise<void> {
        this.#client = await createYourTicketProviderClient();
        this.#configuration = {
            delayBetweenPurchaseImportsMs: 1000,
            maximumPurchasesPerExecution: 10,
        };
    }

    /**
     * Executes the task in the task scheduler's environment. Both ticket types and purchases will
     * be synchronised for all active and upcoming events.
     */
    override async execute(): Promise<boolean> {
        await this.initialise();

        const purchasesJoin = tYourTicketProviderPurchases.forUseInLeftJoin();
        const ticketsJoin = tYourTicketProviderTickets.forUseInLeftJoin();

        const dbInstance = db;
        const applicableEvents = await dbInstance.selectFrom(tEvents)
            .leftJoin(purchasesJoin)
                .on(purchasesJoin.ytpPurchaseEventId.equals(tEvents.eventYtpEventId))
            .leftJoin(ticketsJoin)
                .on(ticketsJoin.ytpTicketEventId.equals(tEvents.eventYtpEventId))
                    .and(ticketsJoin.ytpTicketDeleted.isNull())
            .where(tEvents.eventHidden.equals(/* false= */ 0))
                .and(tEvents.eventEndTime.greaterOrEqual(dbInstance.currentZonedDateTime()))
                .and(tEvents.eventYtpEventId.isNotNull())
            .select({
                name: tEvents.eventShortName,
                endTime: tEvents.eventEndTime,
                context: {
                    eventId: tEvents.eventYtpEventId,
                    externalEventId: tEvents.eventYtpExternalEventId,
                },
                mostRecentUpdate: dbInstance.max(purchasesJoin.ytpPurchaseItemUpdated),
                tickets: dbInstance.aggregateAsArray({
                    id: ticketsJoin.ytpTicketId,
                    Name: ticketsJoin.ytpTicketName,
                    Price: ticketsJoin.ytpTicketPrice,
                    Amount: ticketsJoin.ytpTicketAmount,
                    SoldOut: ticketsJoin.ytpTicketSoldOut.equals(/* true= */ 1),
                    Live: ticketsJoin.ytpTicketLive.equals(/* true= */ 1),
                    IsSubProduct: ticketsJoin.ytpTicketIsSubproduct.equals(/* true= */ 1),
                    SalesStart: ticketsJoin.ytpTicketSalesStart,
                    SalesEnd: ticketsJoin.ytpTicketSalesEnd,
                    Updated: ticketsJoin.ytpTicketUpdated,
                }),
            })
            .groupBy(tEvents.eventYtpEventId)
            .executeSelectMany();

        for (const event of applicableEvents) {
            if (!event.context?.eventId)
                throw new Error(`Unable to update ${event.name} data without an event ID`);

            this.log.info(`Starting data import for ${event.name}`);

            await this.importTicketTypes(event.context.eventId, event.tickets);

            if (!!event.context.externalEventId) {
                await this.importPurchases(
                    event.context.eventId, event.context.externalEventId, event.mostRecentUpdate);
            } else {
                this.log.debug('[Purchases] No external event ID has been defined; skipping');
            }

            this.updateTaskIntervalForFestivalDate(event.endTime);
        }

        return true;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Method to import the ticket types that exist for the given `eventId`.
     */
    private async importTicketTypes(eventId: number, knownTickets: KnownTicketInformation[])
        : Promise<boolean>
    {
        const knownTicketsMap = new Map(knownTickets.map(ticket => [ ticket.id, ticket ]));

        this.log.info('[Tickets] Fetching ticket types from the YourTicketProvider API');

        const liveTickets = await this.#client.listTicketsAndProducts(eventId);
        if (!liveTickets.length) {
            this.log.warning('[Tickets] No tickets were returned by the API; skipping');
            return false;
        }

        this.log.info(`[Tickets] YourTicketProvider responded with ${liveTickets.length} type(s)`);

        const dbInstance = db;
        return dbInstance.transaction(async () => {
            const seenTickets = new Set<number>();

            let added = 0, deleted = 0, updated = 0;

            for (const liveTicket of liveTickets) {
                const knownTicket = knownTicketsMap.get(liveTicket.Id);

                let ytpTicketSalesStart: Temporal.ZonedDateTime | undefined;
                let ytpTicketSalesEnd: Temporal.ZonedDateTime | undefined;

                if (!!liveTicket.SalesStart) {
                    ytpTicketSalesStart =
                        Temporal.Instant.from(liveTicket.SalesStart)
                            .round('seconds').toZonedDateTimeISO('UTC');
                }

                if (!!liveTicket.SalesEnd) {
                    ytpTicketSalesEnd =
                        Temporal.Instant.from(liveTicket.SalesEnd)
                            .round('seconds').toZonedDateTimeISO('UTC');
                }

                let ytpTicketUpdated = Temporal.Now.zonedDateTimeISO('UTC');
                if (!!knownTicket) {
                    if (knownTicket.Name === liveTicket.Name &&
                        knownTicket.Price === liveTicket.Price &&
                        knownTicket.Amount === liveTicket.Amount &&
                        knownTicket.SoldOut === !!liveTicket.SoldOut &&
                        knownTicket.Live === !!liveTicket.Live &&
                        knownTicket.IsSubProduct === !!liveTicket.IsSubproduct &&
                        !ZonedDateTimesAreDifferent(knownTicket.SalesStart, ytpTicketSalesStart) &&
                        !ZonedDateTimesAreDifferent(knownTicket.SalesEnd, ytpTicketSalesEnd))
                    {
                        ytpTicketUpdated = knownTicket.Updated;
                        updated++;
                    }
                } else {
                    added++;
                }

                await dbInstance.insertInto(tYourTicketProviderTickets)
                    .set({
                        ytpTicketId: liveTicket.Id,
                        ytpTicketEventId: eventId,
                        ytpTicketName: liveTicket.Name,
                        ytpTicketPrice: liveTicket.Price,
                        ytpTicketAmount: liveTicket.Amount,
                        ytpTicketSoldOut: liveTicket.SoldOut ? 1 : 0,
                        ytpTicketLive: liveTicket.Live ? 1 : 0,
                        ytpTicketIsSubproduct: liveTicket.IsSubproduct ? 1 : 0,
                        ytpTicketSalesStart,
                        ytpTicketSalesEnd,
                        ytpTicketCreated: dbInstance.currentZonedDateTime(),
                        ytpTicketUpdated: dbInstance.currentZonedDateTime(),
                        ytpTicketDeleted: null,
                    })
                    .onConflictDoUpdateSet({
                        ytpTicketName: liveTicket.Name,
                        ytpTicketPrice: liveTicket.Price,
                        ytpTicketAmount: liveTicket.Amount,
                        ytpTicketSoldOut: liveTicket.SoldOut ? 1 : 0,
                        ytpTicketLive: liveTicket.Live ? 1 : 0,
                        ytpTicketIsSubproduct: liveTicket.IsSubproduct ? 1 : 0,
                        ytpTicketSalesStart,
                        ytpTicketSalesEnd,
                        ytpTicketUpdated,
                        ytpTicketDeleted: null,
                    })
                    .executeInsert();

                seenTickets.add(liveTicket.Id);
            }

            for (const knownTicket of knownTickets) {
                if (seenTickets.has(knownTicket.id))
                    continue;

                deleted++;
                await dbInstance.update(tYourTicketProviderTickets)
                    .set({
                        ytpTicketDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tYourTicketProviderTickets.ytpTicketId.equals(knownTicket.id))
                        .and(tYourTicketProviderTickets.ytpTicketDeleted.isNull())
                    .executeUpdate();
            }

            this.log.info(`[Tickets] Added: ${added}, updated: ${updated}, deleted: ${deleted}`);
            return true;
        });
    }

    /**
     * Method to import the latest purchases for the given `eventId` that happened after the given
     * `mostRecentUpdate`. This will issue up to 2n+1 API calls to the YourTicketProvider API
     */
    private async importPurchases(
        eventId: number, externalEventId: string, mostRecentUpdate?: Temporal.ZonedDateTime)
            : Promise<boolean>
    {
        mostRecentUpdate ||= Temporal.Now.zonedDateTimeISO('UTC').subtract({ years: 1 });

        this.log.info('[Purchases] Fetching purchases from the YourTicketProvider API');
        this.log.info(`[Purchases] w/ last updated = ${mostRecentUpdate.toString()}`);

        const recentPurchases = await this.#client.queryVisitorInformation(externalEventId, {
            type: 'lastUpdated',
            since: mostRecentUpdate,
            take: this.#configuration.maximumPurchasesPerExecution,
            skip: 0,
        });

        if (!recentPurchases.length) {
            this.log.warning('[Purchases] No purchases were returned by the API; skipping');
            return false;
        }

        this.log.info(
            `[Purchases] YourTicketProvider responded with ${recentPurchases.length} purchase(s)`);

        // -----------------------------------------------------------------------------------------
        // (1) Fetch existing information from the database to enable early elimination. Each ticket
        //     import requires two additional API calls, which we want to minimise.
        // -----------------------------------------------------------------------------------------

        const recentPurchaseIds = recentPurchases.map(purchase =>
            parseInt(purchase.reference.slice(3), /* radix= */ 10));

        const dbInstance = db;
        const knownPurchaseRecords = await dbInstance.selectFrom(tYourTicketProviderPurchases)
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(eventId))
                .and(tYourTicketProviderPurchases.ytpPurchaseId.in(recentPurchaseIds))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseId,
                tickets: dbInstance.aggregateAsArray({
                    barcode: tYourTicketProviderPurchases.ytpPurchaseItemBarcode,
                    complimentary:
                        tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(/* true= */ 1),
                    cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled,
                    holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                }),
            })
            .groupBy(tYourTicketProviderPurchases.ytpPurchaseId)
            .executeSelectMany();

        const knownPurchaseRecordMap =
            new Map(knownPurchaseRecords.map(record => [ record.id, record ]));

        // -----------------------------------------------------------------------------------------
        // (2) Process the latest updated purchases. Early eliminate updates when none of the data
        //     we store has been invalidated.
        // -----------------------------------------------------------------------------------------

        let updated = 0;
        for (const purchase of recentPurchases) {
            const purchaseId = parseInt(purchase.reference.slice(3), /* radix= */ 10);

            let cancellationDate: Temporal.ZonedDateTime | undefined;

            const knownPurchase = knownPurchaseRecordMap.get(purchaseId);
            if (!!knownPurchase && knownPurchase.tickets.length === purchase.tickets.length) {
                const knownTicketsMap = new Map(
                    knownPurchase.tickets.map(ticket => [ ticket.barcode, ticket ]));

                let changeIdentified = false;
                for (const ticket of purchase.tickets) {
                    const knownTicket = knownTicketsMap.get(ticket.barcode);
                    if (!knownTicket) {
                        changeIdentified = true;
                        break;
                    }

                    if (!cancellationDate && !!knownTicket.cancelled)
                        cancellationDate = knownTicket.cancelled;

                    const complimentary = ticket.source === 'GuestList';
                    if (complimentary !== knownTicket.complimentary) {
                        changeIdentified = true;
                        break;
                    }

                    const cancelled = ticket.status !== 'Valid';
                    if (cancelled !== !!knownTicket.cancelled) {
                        changeIdentified = true;
                        break;
                    }

                    const basicInformationTicketHolder = [
                        ticket.basicInformation?.firstname,
                        ticket.basicInformation?.lastname,
                    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || undefined;

                    if (basicInformationTicketHolder !== knownTicket.holder) {
                        changeIdentified = true;
                        break;
                    }

                    // If we reach this point in the control flow then no changes have been found in
                    // this |ticket|. This may very well end up being the case for all tickets.
                }

                // When no changes in the existing tickets have been identified, this update most
                // likely represents a scan or an update in fields we don't care about. Skip it.
                if (!changeIdentified) {
                    this.log.debug(
                        `[Purchases] No changes identified in purchase ${purchaseId}; skipping`);
                    continue;
                }
            }

            const delayMs = this.#configuration.delayBetweenPurchaseImportsMs;
            if (delayMs > 0) {
                this.log.debug(`[Purchases] Waiting ${delayMs}ms…`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            this.log.info(`[Purchases] Updating purchase ${purchaseId} using the Ticketing API`);
            {
                await this.importIndividualPurchase(eventId, purchaseId, cancellationDate);
                updated++;
            }
        }

        this.log.info(`[Purchases] Completed the synchronisation (updated = ${updated})`);
        return true;
    }

    /**
     * Method to import all metadata required for the given `purchaseId` that exists with the given
     * `eventId`. This will issue two API calls to the YourTicketProvider API.
     */
    private async importIndividualPurchase(
        eventId: number, purchaseId: number, cancellationDate?: Temporal.ZonedDateTime)
            : Promise<boolean>
    {
        const purchase = await this.#client.fetchPurchase(purchaseId);
        const purchaseItems = await this.#client.fetchPurchaseItems(purchaseId);

        const dbInstance = db;
        return dbInstance.transaction(async () => {
            for (const item of purchaseItems) {
                let ytpPurchaseDatePaid: Temporal.ZonedDateTime | undefined;
                let ytpPurchaseDateCancelled: Temporal.ZonedDateTime | undefined = cancellationDate;

                if (!!purchase.PaidDate) {
                    ytpPurchaseDatePaid =
                        Temporal.Instant.from(purchase.PaidDate)
                            .round('seconds').toZonedDateTimeISO('UTC');
                }

                if (!!purchase.Cancelled && !cancellationDate)
                    ytpPurchaseDateCancelled = Temporal.Now.zonedDateTimeISO('UTC');

                const ytpPurchaseItemHolder = [
                    item.TicketHolderFirstname,
                    item.TicketHolderInsertion,
                    item.TicketHolderLastname,
                ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;

                await dbInstance.insertInto(tYourTicketProviderPurchases)
                    .set({
                        ytpPurchaseId: purchaseId,
                        ytpPurchaseEventId: eventId,
                        ytpPurchaseComplimentary: purchase.TotalAmount === 0 ? 1 : 0,
                        ytpPurchaseDateCancelled,
                        ytpPurchaseDatePaid,
                        ytpPurchaseItemId: item.Id,
                        ytpPurchaseItemTicketId: item.TicketId,
                        ytpPurchaseItemBarcode: `${item.Barcode}`,
                        ytpPurchaseItemHolder,
                        ytpPurchaseItemUpdated: dbInstance.currentZonedDateTime(),
                    })
                    .onConflictDoUpdateSet({
                        ytpPurchaseComplimentary: purchase.TotalAmount === 0 ? 1 : 0,
                        ytpPurchaseDateCancelled,
                        ytpPurchaseDatePaid,
                        ytpPurchaseItemBarcode: `${item.Barcode}`,
                        ytpPurchaseItemHolder,
                        ytpPurchaseItemUpdated: dbInstance.currentZonedDateTime(),
                    })
                    .executeInsert();
            }

            return true;
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
        const configuration = YourTicketProviderImportTask.kIntervalConfiguration;
        const maximumInterval = YourTicketProviderImportTask.kIntervalMaximum;

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
