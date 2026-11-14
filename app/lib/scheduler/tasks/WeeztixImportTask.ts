// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { WeeztixClient } from '@lib/integrations/weeztix';
import { Task } from '../Task';
import { createWeeztixClient } from '@lib/integrations/weeztix';
import db, { tEvents } from '@lib/database';

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
            maximumOrderImportsPerExecution: 1,
            maximumOrdersConsideredPerExecution: 100,
            raceConditionCompensationHours: 12,
        };
    }

    /**
     * Executes the task in the task scheduler's environment. Orders will be synchronised for all
     * active and upcoming events configured to use Weeztix.
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
            if (!event.context?.eventGuid)
                throw new Error(`Unable to update ${event.name} data without a Weeztix event GUID`);

            this.log.info(`Starting data import for ${event.name}`);

            await this.importProductsAndTickets(event.context.eventGuid);
            break;

            if (!!event.context.companyGuid) {
                await this.importOrders(
                    event.context.companyGuid, event.context.eventGuid,
                    /* mostRecentUpdate= */ undefined);
            } else {
                this.log.warning('[Orders] No Weeztix company GUID has been defined; skipping');
            }

            // TODO: Import ticket types and revalidate `FinanceProcessor` once tables exist.
        }

        this.updateTaskIntervalForFestivalDate(applicableEvents[0].endTime);

        return true;
    }

    /**
     * Method to import the products and tickets that exist for the given `eventGuid`.
     */
    private async importProductsAndTickets(eventGuid: string): Promise<boolean> {
        const tickets = await this.#client.listTicketTypes(eventGuid);

        // TODO: Implement this method.

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
