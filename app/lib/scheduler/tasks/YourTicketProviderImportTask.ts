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
 * purchased items. A pseudonomous variant of an item's holder will be stored ("Peter B."), whereas
 * all other information will intentionally be ignored from a privacy point of view.
 */
export class YourTicketProviderImportTask extends Task {
    static run() {
        const taskContext = TaskContext.forEphemeralTask('YourTicketProviderImportTask', null);
        const task = new YourTicketProviderImportTask(taskContext);

        return task.execute();
    }

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
            delayBetweenPurchaseImportsMs: 500,
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
            .where(tEvents.eventHidden.equals(/* false= */ 0))
                .and(tEvents.eventEndTime.greaterOrEqual(dbInstance.currentZonedDateTime()))
                .and(tEvents.eventYtpEventId.isNotNull())
            .select({
                name: tEvents.eventShortName,
                context: {
                    eventId: tEvents.eventYtpEventId,
                    externalEventId: tEvents.eventYtpExternalEventId,
                },
                mostRecentPurchase: dbInstance.max(purchasesJoin.ytpPurchaseDatePaid),
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

            await this.importTicketTypes(event.context.eventId, event.tickets);

            if (!!event.context.externalEventId) {
                await this.importPurchases(
                    event.context.eventId, event.context.externalEventId, event.mostRecentPurchase);
            }
        }

        // TODO: Logging
        // TODO: Rescheduling interval

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

        const liveTickets = await this.#client.listTicketsAndProducts(eventId);
        if (!liveTickets.length)
            return false;  // no tickets have been created for the event

        const dbInstance = db;
        return await dbInstance.transaction(async () => {
            const seenTickets = new Set<number>();

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

                let ytpTicketUpdated: Temporal.ZonedDateTime | undefined;
                if (!!knownTicket) {
                    ytpTicketUpdated = knownTicket.Updated;
                    if (knownTicket.Name !== liveTicket.Name ||
                        knownTicket.Price !== liveTicket.Price ||
                        knownTicket.Amount !== liveTicket.Amount ||
                        knownTicket.SoldOut !== !!liveTicket.SoldOut ||
                        knownTicket.Live !== !!liveTicket.Live ||
                        knownTicket.IsSubProduct !== !!liveTicket.IsSubproduct ||
                        ZonedDateTimesAreDifferent(knownTicket.SalesStart, ytpTicketSalesStart) ||
                        ZonedDateTimesAreDifferent(knownTicket.SalesEnd, ytpTicketSalesEnd))
                    {
                        ytpTicketUpdated = Temporal.Now.zonedDateTimeISO('UTC');
                    }
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

                await dbInstance.update(tYourTicketProviderTickets)
                    .set({
                        ytpTicketDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tYourTicketProviderTickets.ytpTicketId.equals(knownTicket.id))
                        .and(tYourTicketProviderTickets.ytpTicketDeleted.isNull())
                    .executeUpdate();
            }

            return true;
        });
    }

    /**
     * Method to import the latest purchases for the given `eventId` that happened after the given
     * `mostRecentPurchase`. This will issue up to 2n+1 API calls to the YourTicketProvider API
     */
    private async importPurchases(
        eventId: number, externalEventId: string, mostRecentPurchase?: Temporal.ZonedDateTime)
            : Promise<boolean>
    {
        return false;
    }

    /**
     * Method to import all metadata required for the given `purchaseId` that exists with the given
     * `eventId`. This will issue two API calls to the YourTicketProvider API.
     */
    private async importIndividualPurchase(eventId: number, purchaseId: number): Promise<boolean> {
        return false;
    }
}
