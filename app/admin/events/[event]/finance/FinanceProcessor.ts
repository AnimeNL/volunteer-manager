// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { fetchFinancialData, type FinancialData } from './processor/FinancialData';

import * as views from './processor/FinancialView';

declare namespace globalThis {
    let animeConFinanceProcessorCache: Map<string, FinanceProcessor | undefined> | undefined;
}

/**
 * Processor that provides operations to work with the financial information of a particular event,
 * including comparisons to past events. Groups together all finance-related logic.
 */
export class FinanceProcessor {
    /**
     * Clears any cached processors for the given `event`.
     */
    static clearForEvent(event: string): void {
        globalThis.animeConFinanceProcessorCache?.delete(event);
    }

    /**
     * Retrieves the processor for the given `event` when it exists in the cache, or creates and
     * initialises a new instance when it doesn't. Returns `undefined` when an instance could not
     * be created for the given `event`, for example because it does not contain financial data.
     */
    static async getOrCreateForEvent(event: string): Promise<FinanceProcessor | undefined> {
        if (!globalThis.animeConFinanceProcessorCache)
            globalThis.animeConFinanceProcessorCache = new Map;

        if (globalThis.animeConFinanceProcessorCache.has(event))
            return globalThis.animeConFinanceProcessorCache.get(event);

        const financialData = await fetchFinancialData(event);
        const financialProcessor = financialData
            ? new FinanceProcessor(financialData)
            : undefined;

        globalThis.animeConFinanceProcessorCache.set(event, financialProcessor);
        return financialProcessor;
    }

    // ---------------------------------------------------------------------------------------------

    // Generic data:
    readonly #eventId: number | undefined;
    readonly #remainingDays: number;

    // KPI overview:
    readonly #eventTicketRevenueView: ReturnType<typeof views.generateEventTicketRevenueView>;
    readonly #eventTicketSalesView: ReturnType<typeof views.generateEventTicketSalesView>;
    readonly #ticketRevenueView: ReturnType<typeof views.generateTicketRevenueView>;
    readonly #ticketSalesView: ReturnType<typeof views.generateTicketSalesView>;

    // Data tables:
    readonly #eventSalesTableView: ReturnType<typeof views.generateEventSalesTableView>;
    readonly #lockerSalesTableView: ReturnType<typeof views.generateLockerSalesTableView>;
    readonly #ticketSalesTableView: ReturnType<typeof views.generateTicketSalesTableView>;

    // Graphs:
    readonly #lockerSalesGraphView: ReturnType<typeof views.generateLockerSalesGraphView>;
    readonly #ticketSalesGraphView: ReturnType<typeof views.generateTicketSalesGraphView>;

    private constructor(financialData: FinancialData) {
        this.#eventId = financialData.data[0]?.id;
        this.#remainingDays = financialData.remaining;

        this.#eventTicketRevenueView = views.generateEventTicketRevenueView(financialData);
        this.#eventTicketSalesView = views.generateEventTicketSalesView(financialData);
        this.#ticketRevenueView = views.generateTicketRevenueView(financialData);
        this.#ticketSalesView = views.generateTicketSalesView(financialData);

        this.#eventSalesTableView = views.generateEventSalesTableView(financialData);
        this.#lockerSalesTableView = views.generateLockerSalesTableView(financialData);
        this.#ticketSalesTableView = views.generateTicketSalesTableView(financialData);

        this.#lockerSalesGraphView = views.generateLockerSalesGraphView(financialData);
        this.#ticketSalesGraphView = views.generateTicketSalesGraphView(financialData);
    }

    // ---------------------------------------------------------------------------------------------

    get eventId() { return this.#eventId; }
    get remainingDays() { return this.#remainingDays; }

    get eventTicketRevenueView() { return this.#eventTicketRevenueView; }
    get eventTicketSalesView() { return this.#eventTicketSalesView; }
    get ticketRevenueView() { return this.#ticketRevenueView; }
    get ticketSalesView() { return this.#ticketSalesView; }

    get eventSalesTableView() { return this.#eventSalesTableView; }
    get lockerSalesTableView() { return this.#lockerSalesTableView; }
    get ticketSalesTableView() { return this.#ticketSalesTableView; }

    get lockerSalesGraphView() { return this.#lockerSalesGraphView; }
    get ticketSalesGraphView() { return this.#ticketSalesGraphView; }
}
