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
    function IsEvent(product: { category: EventSalesCategory }): boolean {
        return product.category === kEventSalesCategory.Event;
    }

    return generateSalesTableView(IsEvent, financialData);
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
 * Generates a graph view for locker sales and occupation expectations during the event.
 */
export function generateLockerSalesGraphView(financialData: FinancialData) {
    return generateSalesGraphView('lockers', financialData);
}

/**
 * Generates the view necessary to populate the `<LockerSalesTable>` component.
 */
export function generateLockerSalesTableView(financialData: FinancialData) {
    function IsLocker(product: { category: EventSalesCategory }): boolean {
        return product.category === kEventSalesCategory.Locker ||
               product.category === kEventSalesCategory.LockerFriday ||
               product.category === kEventSalesCategory.LockerSaturday ||
               product.category === kEventSalesCategory.LockerSunday ||
               product.category === kEventSalesCategory.LockerWeekend;
    }

    return generateSalesTableView(IsLocker, financialData);
}

type ProductFilterFn = (product: { category: EventSalesCategory }) => boolean;

/**
 * Generates a sales graph view for products of the given |type|. Two data series will be returned,
 * one specific to sales, and one specific to actual use. (E.g. weekend sales multiply across days.)
 */
function generateSalesGraphView(type: 'lockers' | 'tickets', financialData: FinancialData) {
    if (!financialData.data.length)
        return [ /* no event, no products */ ];

    const kOccupancySuffix = type === 'lockers' ? 'occupied lockers' : 'visitors';
    const kSalesSuffix = type === 'lockers'? 'locker sales' : 'ticket sales';

    const kIndexFriday = 0;
    const kIndexSaturday = 1;
    const kIndexSunday = 2;
    const kIndexWeekend = 3;  // only valid for |salesSeries|

    const kProductCategoryToIndexMapping: { [key in EventSalesCategory]?: number } =
        type === 'lockers' ? {
            [kEventSalesCategory.LockerFriday]: kIndexFriday,
            [kEventSalesCategory.LockerSaturday]: kIndexSaturday,
            [kEventSalesCategory.LockerSunday]: kIndexSunday,
            [kEventSalesCategory.LockerWeekend]: kIndexWeekend,
        } : {
            [kEventSalesCategory.TicketFriday]: kIndexFriday,
            [kEventSalesCategory.TicketSaturday]: kIndexSaturday,
            [kEventSalesCategory.TicketSunday]: kIndexSunday,
            [kEventSalesCategory.TicketWeekend]: kIndexWeekend,
        };

    type SalesGraphPoint = { color: string; label: string; value: number; };

    const occupancySeries = [ 'Friday', 'Saturday', 'Sunday' ].map((label, index) => ({
        color: kSalesBarColors[index],
        label: `${label} (${kOccupancySuffix})`,
        value: 0,
    })) satisfies SalesGraphPoint[];

    const salesSeries = [ 'Friday', 'Saturday', 'Sunday', 'Weekend' ].map((label, index) => ({
        color: kSalesBarColors[index],
        label: `${label} (${kSalesSuffix})`,
        value: 0,
    })) satisfies SalesGraphPoint[];

    for (const product of financialData.data[0].products.values()) {
        const seriesIndex = kProductCategoryToIndexMapping[product.category];
        if (seriesIndex === undefined)
            continue;

        for (const sales of product.sales.values()) {
            salesSeries[seriesIndex].value += sales;
            if (seriesIndex !== kIndexWeekend) {
                occupancySeries[seriesIndex].value += sales;
            } else {
                occupancySeries[kIndexFriday].value += sales;
                occupancySeries[kIndexSaturday].value += sales;
                occupancySeries[kIndexSunday].value += sales;
            }
        }
    }

    return [ { data: occupancySeries }, { data: salesSeries } ];
}

/**
 * Generates a sales table view for products matching the given |filter|. Only the first event in
 * the |financialData| will be considered.
 */
function generateSalesTableView(filter: ProductFilterFn, financialData: FinancialData) {
    if (!financialData.data.length)
        return [ /* no event, no products */ ];

    const baseHref = `/admin/events/${financialData.data[0].slug}/program/activities`;

    return [ ...financialData.data[0].products.values() ].filter(filter).map(product => {
        let totalRevenue: number = 0;
        let totalSales: number = 0;

        for (const sales of product.sales.values()) {
            totalRevenue += sales * (product.price ?? 0);
            totalSales += sales;
        }

        let href: string | undefined;
        if (!!product.program.id)
            href = `${baseHref}/${product.program.id}`;

        return {
            id: product.id,
            category: product.program.title ?? product.category,
            href,
            product: maybeRemoveProductNameDuplication(product.product, product.program.title),
            productIds: [ product.id ],
            price: product.price,
            totalRevenue,
            totalSales,
            maximumSales: product.limit,
        };

    }).sort((lhs, rhs) => lhs.product.localeCompare(rhs.product));
}

/**
 * Generates a graph view for ticket sales and visitor expectations during the event.
 */
export function generateTicketSalesGraphView(financialData: FinancialData) {
    return generateSalesGraphView('tickets', financialData);
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
    function IsTicket(product: { category: EventSalesCategory }): boolean {
        return isTicketSalesCategory(product.category);
    }

    return generateSalesTableView(IsTicket, financialData);
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
 * Attempts to remove duplication from the product's name when the `programTitle` is included as
 * well, in which case displaying the same information twice isn't helpful to anyone.
 */
function maybeRemoveProductNameDuplication(product: string, programTitle?: string): string {
    if (!programTitle)
        return product;

    let normalisedProgramTitle = programTitle;
    if (normalisedProgramTitle.endsWith('18+')) {
        normalisedProgramTitle =
            normalisedProgramTitle.substring(0, normalisedProgramTitle.length - 3).trim();
    }

    if (product.startsWith(normalisedProgramTitle))
        product = product.substring(normalisedProgramTitle.length);
    if (product.startsWith(':'))
        product = product.substring(1);

    return product.trim();
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
