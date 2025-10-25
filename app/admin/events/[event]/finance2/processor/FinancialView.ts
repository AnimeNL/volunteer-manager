// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventSalesCategory } from '@lib/database/Types';
import type { FinancialData } from './FinancialData';
import { formatDate } from '@lib/Temporal';

import { kEventSalesCategory } from '@lib/database/Types';

/**
 * Number of days that should be considered in the change percentage window.
 */
const kChangePercentageWindow = 7;

/**
 * Maximum number of history bars to display in a key metric graph.
 */
const kKeyMetricHistoryBars = 31;

/**
 * Colours to use on the sales graphs.
 */
const kSalesBarColors = [
    '#0079bc',
    '#009eea',
    '#5fbe87',
    '#c1e13e',
];

/**
 * Labels to apply to each of the sales categories.
 */
const kSalesCategoryLabels: { [key in EventSalesCategory]?: string } = {
    Event: 'Event tickets',
    Hidden: 'N/A',
    Locker: 'Lockers',
    TicketFriday: 'Friday',
    TicketSaturday: 'Saturday',
    TicketSunday: 'Sunday',
    TicketWeekend: 'Weekend'
};

/**
 * Generates the view necessary to populate the `<EventSalesTable>` component.
 */
export function generateEventSalesTableView(financialData: FinancialData) {
    if (!financialData.data.length)
        return [ /* no event, no products */ ];

    const baseHref = `/admin/events/${financialData.data[0].slug}/program/activities`;

    function IsEvent(product: { category: EventSalesCategory }): boolean {
        return product.category === kEventSalesCategory.Event;
    }

    return [ ...financialData.data[0].products.values() ].filter(IsEvent).map(product => {
        let totalRevenue: number = 0;
        let totalSales: number = 0;

        for (const sales of product.sales.values()) {
            totalRevenue += sales * (product.price ?? 0);
            totalSales += sales;
        }

        let href: string | undefined;
        if (!!product.programId)
            href = `${baseHref}/${product.programId}`;

        return {
            id: product.id,
            href,
            product: product.product,
            salesLimit: product.limit,
            totalRevenue,
            totalSales,
        };

    }).sort((lhs, rhs) => lhs.product.localeCompare(rhs.product));
}

/**
 * Generates the view necessary to populate the `<EventRevenueCard>` component.
 */
export function generateEventTicketRevenueView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, {
        eventTicketSales: true,
        figure: 'revenue',
    });
}

/**
 * Generates the view necessary to populate the `<EventSalesCard>` component.
 */
export function generateEventTicketSalesView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, {
        eventTicketSales: true,
        figure: 'sales',
    });
}

/**
 * Generates the view necessary to populate the `<LockerSalesTable>` component.
 */
export function generateLockerSalesTableView(financialData: FinancialData) {
    if (!financialData.data.length)
        return [ /* no event, no products */ ];

    function IsLocker(product: { category: EventSalesCategory }): boolean {
        return product.category === kEventSalesCategory.Locker;
    }

    return [ ...financialData.data[0].products.values() ].filter(IsLocker).map(product => {
        let totalRevenue: number = 0;
        let totalSales: number = 0;

        for (const sales of product.sales.values()) {
            totalRevenue += sales * (product.price ?? 0);
            totalSales += sales;
        }

        return {
            id: product.id,
            programId: product.programId,
            product: product.product,
            salesLimit: product.limit,
            totalRevenue,
            totalSales,
        };

    }).sort((lhs, rhs) => lhs.product.localeCompare(rhs.product));
}

/**
 * Generates the view necessary to populate the `<TicketRevenueCard>` component.
 */
export function generateTicketRevenueView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, {
        figure: 'revenue',
        ticketSales: true,
    });
}

/**
 * Generates the view necessary to populate the `<TicketSalesTable>` component.
 */
export function generateTicketSalesTableView(financialData: FinancialData) {
    if (!financialData.data.length)
        return [ /* no event, no products */ ];

    function IsTicket(product: { category: EventSalesCategory }): boolean {
        switch (product.category) {
            case kEventSalesCategory.TicketFriday:
            case kEventSalesCategory.TicketSaturday:
            case kEventSalesCategory.TicketSunday:
            case kEventSalesCategory.TicketWeekend:
                return true;

            default:
                return false;
        }
    }

    return [ ...financialData.data[0].products.values() ].filter(IsTicket).map(product => {
        let totalRevenue: number = 0;
        let totalSales: number = 0;

        for (const sales of product.sales.values()) {
            totalRevenue += sales * (product.price ?? 0);
            totalSales += sales;
        }

        return {
            id: product.id,
            programId: product.programId,
            product: product.product,
            salesLimit: product.limit,
            totalRevenue,
            totalSales,
        };

    }).sort((lhs, rhs) => lhs.product.localeCompare(rhs.product));
}

/**
 * Generates the view necessary to populate the `<TicketSalesCard>` component.
 */
export function generateTicketSalesView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, {
        figure: 'sales',
        ticketSales: true,
    });
}

/**
 * Utility function to determine whether |category| describes ticket sales.
 */
function isTicketSalesCategory(category: EventSalesCategory): boolean {
    return category === kEventSalesCategory.TicketFriday ||
           category === kEventSalesCategory.TicketSaturday ||
           category === kEventSalesCategory.TicketSunday ||
           category === kEventSalesCategory.TicketWeekend;
}

/**
 * Selection criteria when computing key metric data.
 */
interface KeyMetricSelection {
    /**
     * Whether event ticket sales should be considered in the selection.
     */
    eventTicketSales?: boolean;

    /**
     * Type of metric that should be computed from the sales.
     */
    figure: 'revenue' | 'sales';

    /**
     * Whether ticket sales should be considered in the selection.
     */
    ticketSales?: boolean;
}

/**
 * Computes key metrics data from the given `financialData` based on the `selection`.
 */
function computeKeyMetricsData(financialData: FinancialData, selection: KeyMetricSelection) {
    return financialData.data.map(event => {
        let computedFigure = 0;

        const historyWindowStart = financialData.remaining + kKeyMetricHistoryBars;
        const historyWindowEnd = financialData.remaining;
        const history = new Map<EventSalesCategory, number[]>;

        // -----------------------------------------------------------------------------------------

        for (const product of event.products.values()) {
            if (selection.eventTicketSales && product.category !== kEventSalesCategory.Event)
                continue;  // filter out non-event ticket sales
            if (selection.ticketSales && !isTicketSalesCategory(product.category))
                continue;  // filter out non-ticket sales

            if (selection.figure === 'revenue' && !product.price)
                continue;  // unable to consider free products, or products with no known price

            if (!history.has(product.category))
                history.set(product.category, [ ...Array(kKeyMetricHistoryBars) ].map(_ => 0));

            for (const [ days, sale ] of product.sales.entries()) {
                if (days < financialData.remaining)
                    continue;

                const figure = selection.figure === 'revenue' ? sale * product.price!
                                                              : sale;

                // Record this |figure| in the history overview if |days| is within the window. Each
                // product category may appear multiple times, as does each individual day of sales.
                if (days < historyWindowStart && days >= historyWindowEnd)
                    history.get(product.category)![days - historyWindowEnd] += figure;

                computedFigure += figure;
            }
        }

        // -----------------------------------------------------------------------------------------

        const sortedHistory =
            [ ...history.entries() ].sort((lhs, rhs) => lhs[0].localeCompare(rhs[0]));

        const normalisedHistory = sortedHistory.map((entry, index) => ({
            type: 'bar' as const,  // <KeyMetricGraph> requirement
            stack: 'total',  // <KeyMetricGraph> requirement
            data: entry[1].reverse(),
            label: kSalesCategoryLabels[entry[0]],
            color: kSalesBarColors[index],
        }));

        const historyLabels: string[] = [ /* none yet */ ];
        for (let days = historyWindowStart - 1; days >= historyWindowEnd; --days) {
            historyLabels.push(
                formatDate(financialData.referenceDate.subtract({ days }), 'dddd, MMMM D'));
        }

        // -----------------------------------------------------------------------------------------

        let changePercentage: number | undefined;
        if (normalisedHistory[0]?.data.length >= 2 * kChangePercentageWindow) {
            const window = kChangePercentageWindow;

            const currentPeriodFigure = computeTotalFigure(normalisedHistory, 0, window);
            const previousPeriodFigure = computeTotalFigure(normalisedHistory, window, 2 * window);

            if (!!previousPeriodFigure) {
                const preciseChangePercentage =
                    ((currentPeriodFigure - previousPeriodFigure) / previousPeriodFigure) * 100;

                changePercentage = Math.round(preciseChangePercentage * 10) / 10;
            }
        }

        // -----------------------------------------------------------------------------------------

        return {
            label: event.shortName,
            changePercentage,
            figure: computedFigure,
            history: {
                data: normalisedHistory,
                labels: historyLabels,
            },
        };
    });
}

/**
 * Input necessary to compute total sales in a particular period of time.
 */
type TotalSalesInput = { data: number[] };

/**
 * Computes the total figure across all series for the given `input` between days `start` and `end`.
 */
function computeTotalFigure(input: TotalSalesInput[], start: number, end: number): number {
    let totalFigure = 0;

    for (const { data } of input) {
        const startIndex = data.length - start - 1;
        const endIndex = data.length - end - 1;

        for (let index = startIndex; index > endIndex; --index)
            totalFigure += data[index];
    }

    return totalFigure;
}
