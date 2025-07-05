// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { fetchFinancialData, type FinancialData } from './processor/FinancialData';

import * as views from './processor/FinancialView';

/**
 * Processor that provides operations to work with the financial information of a particular event,
 * including comparisons to past events. Groups together all finance-related logic.
 */
export class FinanceProcessor {
    /**
     * Retrieves the processor for the given `event` when it exists in the cache, or creates and
     * initialises a new instance when it doesn't. Returns `undefined` when an instance could not
     * be created for the given `event`, for example because it does not contain financial data.
     */
    static async getOrCreateForEvent(event: string): Promise<FinanceProcessor | undefined> {
        // TODO: Cache initialised FinanceProcessor instances

        const financialData = await fetchFinancialData(event);
        return financialData ? new FinanceProcessor(financialData)
                             : undefined;
    }

    // ---------------------------------------------------------------------------------------------

    // Generic data:
    #remainingDays: number;

    // KPI overview:
    #eventTicketRevenueView: ReturnType<typeof views.generateEventTicketRevenueView>;
    #eventTicketSalesView: ReturnType<typeof views.generateEventTicketSalesView>;
    #ticketRevenueView: ReturnType<typeof views.generateTicketRevenueView>;
    #ticketSalesView: ReturnType<typeof views.generateTicketSalesView>;

    // Data tables:
    #eventSalesTableView: ReturnType<typeof views.generateEventSalesTableView>;

    private constructor(financialData: FinancialData) {
        this.#remainingDays = financialData.remaining;

        this.#eventTicketRevenueView = views.generateEventTicketRevenueView(financialData);
        this.#eventTicketSalesView = views.generateEventTicketSalesView(financialData);
        this.#ticketRevenueView = views.generateTicketRevenueView(financialData);
        this.#ticketSalesView = views.generateTicketSalesView(financialData);

        this.#eventSalesTableView = views.generateEventSalesTableView(financialData);
    }

    // ---------------------------------------------------------------------------------------------

    get remainingDays() { return this.#remainingDays; }

    get eventTicketRevenueView() { return this.#eventTicketRevenueView; }
    get eventTicketSalesView() { return this.#eventTicketSalesView; }
    get ticketRevenueView() { return this.#ticketRevenueView; }
    get ticketSalesView() { return this.#ticketSalesView; }

    get eventSalesTableView() { return this.#eventSalesTableView; }
}
