// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { YourTicketProviderClient } from '@lib/integrations/yourticketprovider/YourTicketProviderClient';
import type { YourTicketProviderTicketsResponse } from '@lib/integrations/yourticketprovider/YourTicketProviderTypes';
import { FinanceProcessor } from '@app/admin/events/[event]/finance/FinanceProcessor';
import { Task } from '../Task';
import { Temporal } from '@lib/Temporal';
import { createYourTicketProviderClient } from '@lib/integrations/yourticketprovider';
import db, { tEvents, tEventsSales, tEventsSalesConfiguration } from '@lib/database';

/**
 * Information made available for a particular event for which YourTicketProvider should be queried.
 */
interface EventInfo {
    id: number;
    slug: string;
    name: string;
    endTime: Temporal.ZonedDateTime;
    yourTicketProviderId: number;
}

/**
 * Returns whether the prices included in |lhs| and |rhs| are different. This is a separate method
 * because the YourTicketProvider API stores these as doubles, which leads to prices such as 20.0018
 * rather than 20.
 */
function arePricesDifferent(lhs?: number, rhs?: number): boolean {
    if (typeof lhs !== typeof rhs)
        return true;  // one is undefined, the other is a number
    if (typeof lhs !== 'number' || typeof rhs !== 'number')
        return false;  // both are undefined

    return Math.abs(lhs - rhs) > 0.01;
}

/**
 * Task that imports ticket sales information from YourTicketProvider. The applicable event(s) will
 * automatically be selected based on their configuration, whereas frequency of data imports will
 * be automatically altered based on proximity to the festival.
 */
export class ImportYourTicketProviderTask extends Task {
    /**
     * The default interval for the import task, when no precise granularity can be decided upon.
     */
    static readonly kIntervalMaximum = /* 1 day= */ 1 * 24 * 3600 * 1000;

    /**
     * Intervals for the tasks based on the number of days until the event happens.
     */
    static readonly kIntervalConfiguration = [
        { maximumDays: /* 4 weeks= */   28, intervalMs: /* 6 hours= */   6 * 3600 * 1000 },
        { maximumDays: /* 12 weeks= */  84, intervalMs: /* 12 hours= */ 12 * 3600 * 1000 },
    ];

    /**
     * The YourTicketProviderClient interface through which we can query the YTP API. Will be
     * created and initialised lazily, right before the first time first access is required.
     */
    #client?: YourTicketProviderClient;

    /**
     * Actually executes the task.
     */
    override async execute(): Promise<boolean> {
        const dbInstance = db;

        const upcomingEvents = await this.determineApplicableUpcomingEvents(dbInstance);
        if (!upcomingEvents.length) {
            this.log.info('Interval: No future events with a ytpEventId, using maximum interval.');
            this.setIntervalForRepeatingTask(ImportYourTicketProviderTask.kIntervalMaximum);
            return true;
        }

        this.updateTaskIntervalForFestivalDate(upcomingEvents[0].endTime);

        for (const event of upcomingEvents)
            await this.executeForEvent(dbInstance, event);

        return true;
    }

    /**
     * Actually executes the task for the given `event`.
     */
    async executeForEvent(dbInstance: typeof db, event: EventInfo): Promise<void> {
        const currentDate = Temporal.Now.plainDateISO();

        const configuration = await this.queryEventSalesConfiguration(dbInstance, event.id);
        const sales = await this.queryEventSales(dbInstance, event.id, currentDate);

        const tickets = await this.fetchEventTicketsFromApi(event.yourTicketProviderId);
        if (!tickets?.length) {
            this.log.info(`${event.name}: No tickets were returned by the API; skipping`);
            return;
        }

        for (const ticketInfo of tickets) {
            let ticketConfiguration = configuration.get(ticketInfo.Id);

            // Step (1): If the |ticketInfo| was not previously known to the Volunteer Manager,
            // create a new configuration entry for the product in the database.
            if (!ticketConfiguration) {
                ticketConfiguration = {
                    id: ticketInfo.Id,

                    description: ticketInfo.Description,
                    limit: ticketInfo.Amount,
                    price: ticketInfo.Price,
                    product: ticketInfo.Name,
                };

                this.log.info(`${event.name}: Product "${ticketInfo.Name}" has been created.`);

                await dbInstance.insertInto(tEventsSalesConfiguration)
                    .set({
                        eventId: event.id,

                        saleId: ticketInfo.Id,
                        saleCategoryLimit: ticketInfo.Amount,
                        saleDescription: ticketInfo.Description,
                        salePrice: ticketInfo.Price,
                        saleProduct: ticketInfo.Name,
                    })
                    .executeInsert();
            }

            // Step (2): If the |ticketInfo| had its metadata updated from the existing metadata,
            // update the configuration entry for the product in the database.
            if (ticketConfiguration.product !== ticketInfo.Name ||
                ticketConfiguration.description !== ticketInfo.Description ||
                ticketConfiguration.limit !== ticketInfo.Amount ||
                arePricesDifferent(ticketConfiguration.price, ticketInfo.Price))
            {
                this.log.info(`${event.name}: Product "${ticketInfo.Name}" has been updated.`);

                await dbInstance.update(tEventsSalesConfiguration)
                    .set({
                        saleCategoryLimit: ticketInfo.Amount,
                        saleDescription: ticketInfo.Description,
                        salePrice: ticketInfo.Price,
                        saleProduct: ticketInfo.Name,
                    })
                    .where(tEventsSalesConfiguration.eventId.equals(event.id))
                        .and(tEventsSalesConfiguration.saleId.equals(ticketConfiguration.id))
                    .executeUpdate();
            }

            // Step (3): Process sales, and issue a log statement when we observe that tickets have
            // been sold *today*, and not just within this update cycle. We need to special case
            // products that haven't been seen before, and products which no longer are live, as
            // the YourTicketProvider API only returns partial information for those.

            if (!ticketInfo.Live && ticketInfo.CurrentAvailable === null) {
                this.log.debug(
                    `${event.name}: Product "${ticketInfo.Name}" ignored, no longer live`);
                continue;
            }

            let currentTicketsSold: number = 0;
            const updatedTicketsSold = ticketInfo.Amount - (ticketInfo.CurrentAvailable ?? 0);

            if (sales.has(ticketInfo.Id)) {
                currentTicketsSold = sales.get(ticketInfo.Id)!;
                if (currentTicketsSold !== updatedTicketsSold) {
                    this.log.info(
                        `${event.name}: Product "${ticketInfo.Name}" records change in sales ` +
                        `today (${currentTicketsSold} -> ${updatedTicketsSold})`);
                }
            } else {
                this.log.info(
                    `${event.name}: Product "${ticketInfo.Name}" records inaugural sales`);
            }

            await dbInstance.insertInto(tEventsSales)
                .set({
                    eventId: event.id,
                    eventSaleId: ticketInfo.Id,
                    eventSaleDate: currentDate,
                    eventSaleCount: updatedTicketsSold - currentTicketsSold,
                    eventSaleUpdated: dbInstance.currentZonedDateTime(),
                })
                .onConflictDoUpdateSet({
                    eventSaleCount: updatedTicketsSold - currentTicketsSold,
                    eventSaleUpdated: dbInstance.currentZonedDateTime(),
                })
                .executeInsert();
        }

        // Reset the cache used for the financial dashboards:
        FinanceProcessor.clearForEvent(event.slug);
    }

    /**
     * Function that determines applicable upcoming events for importing data from the YTP API. This
     * means that the event (1) must not have ended yet, and (2) must have an associated YTP Event
     * ID for whihc information can be obtained.
     */
    async determineApplicableUpcomingEvents(dbInstance: typeof db): Promise<EventInfo[]> {
        return await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventHidden.equals(/* false= */ 0))
                .and(tEvents.eventEndTime.greaterOrEquals(dbInstance.currentZonedDateTime()))
                .and(tEvents.eventYtpId.isNotNull())
            .select({
                id: tEvents.eventId,
                slug: tEvents.eventSlug,
                name: tEvents.eventShortName,
                endTime: tEvents.eventEndTime,
                yourTicketProviderId: tEvents.eventYtpId,
            })
            .orderBy(tEvents.eventEndTime, 'desc')
            .executeSelectMany() as EventInfo[];
    }

    /**
     * Fetches the event ticket information from the YourTicketProvider API. Will issue a call to
     * their server, which may take an arbitrary time to complete. This API further sanitizes the
     * information, to remove excess spacing from names and descriptions.
     */
    async fetchEventTicketsFromApi(yourTicketProviderId: number)
        : Promise<YourTicketProviderTicketsResponse | undefined>
    {
        if (!this.#client)
            this.#client = await createYourTicketProviderClient();

        const tickets = await this.#client.getEventTickets(yourTicketProviderId);
        return tickets.map(ticket => ({
            ...ticket,
            Name: ticket.Name.trim(),
            Description: ticket.Description?.trim(),
        }));
    }

    /**
     * Queries the available event sales information from the database, for the given `eventId`.
     * Returns a Map keyed by the product's ID, and valued by its metadata.
     */
    async queryEventSalesConfiguration(dbInstance: typeof db, eventId: number) {
        const configuration = await dbInstance.selectFrom(tEventsSalesConfiguration)
            .where(tEventsSalesConfiguration.eventId.equals(eventId))
                .and(tEventsSalesConfiguration.saleId.isNotNull())
            .select({
                id: tEventsSalesConfiguration.saleId,

                description: tEventsSalesConfiguration.saleDescription,
                limit: tEventsSalesConfiguration.saleCategoryLimit,
                price: tEventsSalesConfiguration.salePrice,
                product: tEventsSalesConfiguration.saleProduct,
            })
            .executeSelectMany();

        return new Map(configuration.map(entry => ([ entry.id, entry ])));
    }

    /**
     * Queries existing sales information from the database for the given `eventId`. The
     * `currentDate` is significant as that information has to be excluded from the results.
     */
    async queryEventSales(dbInstance: typeof db, eventId: number, currentDate: Temporal.PlainDate) {
        const sales = await dbInstance.selectFrom(tEventsSales)
            .where(tEventsSales.eventId.equals(eventId))
                .and(tEventsSales.eventSaleId.isNotNull())
                .and(tEventsSales.eventSaleDate.isNot(currentDate))
            .select({
                id: tEventsSales.eventSaleId,
                total: dbInstance.sum(tEventsSales.eventSaleCount),
            })
            .groupBy(tEventsSales.eventSaleId)
            .executeSelectMany();

        return new Map(sales.map(entry => ([ entry.id, entry.total ])));
    }

    /**
     * Updates the task's interval based on the distance between the current time and the given
     * `endTime`, effectively applying the `kIntervalConfiguration`.
     */
    updateTaskIntervalForFestivalDate(endTime: Temporal.ZonedDateTime): void {
        const differenceInDays = endTime.since(Temporal.Now.zonedDateTimeISO('UTC'), {
            largestUnit: 'days',
        }).days;

        for (const configurationEntry of ImportYourTicketProviderTask.kIntervalConfiguration) {
            const { maximumDays, intervalMs } = configurationEntry;

            if (differenceInDays > maximumDays)
                continue;

            this.log.info(`Interval: Updating to ${intervalMs}ms (days=${differenceInDays})`);
            this.setIntervalForRepeatingTask(intervalMs);
            return;
        }

        this.log.info('Interval: The event is still very far out, using maximum interval.');
        this.setIntervalForRepeatingTask(ImportYourTicketProviderTask.kIntervalMaximum);
    }
}
