// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory } from '@lib/database/Types';
import type { FinancialData, FinancialProduct } from './FinancialData';
import { formatDate } from '@lib/Temporal';

import { kEventTicketCategory } from '@lib/database/Types';

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
const kSalesCategoryLabels: { [key in EventTicketCategory]?: string } = {
    Event: 'Event tickets',
    Hidden: 'N/A',
    Locker: 'Lockers',
    LockerFriday: 'Friday',
    LockerSaturday: 'Saturday',
    LockerSunday: 'Sunday',
    LockerWeekend: 'Weekend',
    TicketFriday: 'Friday',
    TicketSaturday: 'Saturday',
    TicketSunday: 'Sunday',
    TicketVolunteers: 'Volunteers',
    TicketWeekend: 'Weekend',
};

/**
 * Predicate to determine whether a product describes an event ticket.
 */
const isEventTicket = (product: FinancialProduct): boolean =>
    product.category === kEventTicketCategory.Event;

/**
 * Predicate to determine whether a product describes a festival ticket.
 */
const isFestivalTicket = (product: FinancialProduct): boolean =>
    product.category === kEventTicketCategory.TicketFriday ||
    product.category === kEventTicketCategory.TicketSaturday ||
    product.category === kEventTicketCategory.TicketSunday ||
    product.category === kEventTicketCategory.TicketWeekend;

/**
 * Predicate to determine whether a product describes a locker.
 */
const isLockerProduct = (product: FinancialProduct): boolean =>
    product.category === kEventTicketCategory.Locker ||
    product.category === kEventTicketCategory.LockerFriday ||
    product.category === kEventTicketCategory.LockerSaturday ||
    product.category === kEventTicketCategory.LockerSunday ||
    product.category === kEventTicketCategory.LockerWeekend;

// -------------------------------------------------------------------------------------------------

/**
 * Generates the view necessary to populate the `<EventSalesTable>` component.
 */
export function generateEventSalesTableView(financialData: FinancialData) {
    return generateSalesTableView(isEventTicket, financialData);
}

/**
 * Generates the view necessary to populate the `<EventRevenueCard>` component.
 */
export function generateEventTicketRevenueView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, isEventTicket, 'revenue');
}

/**
 * Generates the view necessary to populate the `<EventSalesCard>` component.
 */
export function generateEventTicketSalesView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, isEventTicket, 'sales');
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
    return generateSalesTableView(isLockerProduct, financialData);
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
    return computeKeyMetricsData(financialData, isFestivalTicket, 'revenue');
}

/**
 * Generates the view necessary to populate the `<TicketSalesTable>` component.
 */
export function generateTicketSalesTableView(financialData: FinancialData) {
    return generateSalesTableView(isFestivalTicket, financialData);
}

/**
 * Generates the view necessary to populate the `<TicketSalesCard>` component.
 */
export function generateTicketSalesView(financialData: FinancialData) {
    return computeKeyMetricsData(financialData, isFestivalTicket, 'sales');
}

// -------------------------------------------------------------------------------------------------

type ProductFilterFn = (product: FinancialProduct) => boolean;

/**
 * Generates a sales graph view for products of the given `type`. Two data series will be returned:
 * one specific to occupancy (use), and one specific to total sales.
 */
function generateSalesGraphView(type: 'lockers' | 'tickets', financialData: FinancialData) {
    if (!financialData.data.length)
        return [];

    const kOccupancySuffix = type === 'lockers' ? 'occupied lockers' : 'visitors';
    const kSalesSuffix = type === 'lockers' ? 'locker sales' : 'ticket sales';

    const kIndexFriday = 0;
    const kIndexSaturday = 1;
    const kIndexSunday = 2;
    const kIndexWeekend = 3;

    const kProductCategoryToIndexMapping: { [key in EventTicketCategory]?: number } =
        type === 'lockers' ? {
            [kEventTicketCategory.LockerFriday]: kIndexFriday,
            [kEventTicketCategory.LockerSaturday]: kIndexSaturday,
            [kEventTicketCategory.LockerSunday]: kIndexSunday,
            [kEventTicketCategory.LockerWeekend]: kIndexWeekend,
        } : {
            [kEventTicketCategory.TicketFriday]: kIndexFriday,
            [kEventTicketCategory.TicketSaturday]: kIndexSaturday,
            [kEventTicketCategory.TicketSunday]: kIndexSunday,
            [kEventTicketCategory.TicketWeekend]: kIndexWeekend,
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
            const count = sales.paid + sales.complimentary;

            salesSeries[seriesIndex].value += count;
            if (seriesIndex !== kIndexWeekend) {
                occupancySeries[seriesIndex].value += count;
            } else {
                occupancySeries[kIndexFriday].value += count;
                occupancySeries[kIndexSaturday].value += count;
                occupancySeries[kIndexSunday].value += count;
            }
        }
    }

    return [ { data: occupancySeries }, { data: salesSeries } ];
}

/**
 * Generates a sales table view for products matching the given `filter`. Only the first event in
 * the `financialData` will be considered.
 */
function generateSalesTableView(filter: ProductFilterFn, financialData: FinancialData) {
    if (!financialData.data.length)
        return [];

    const baseHref = `/admin/events/${financialData.data[0].slug}/program/activities`;

    return [ ...financialData.data[0].products.values() ].filter(filter).map(product => {
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
            paidSales: product.paidSales,
            complimentarySales: product.complimentarySales,
            totalRevenue: product.totalRevenue,
            totalSales: product.totalSales,
            maximumSales: product.limit,
        };

    }).sort((lhs, rhs) => lhs.product.localeCompare(rhs.product));
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
 * Computes key metrics data from the given `financialData` based on the `filter` and `metricType`.
 */
function computeKeyMetricsData(
    financialData: FinancialData,
    filter: ProductFilterFn,
    metricType: 'revenue' | 'sales')
{
    return financialData.data.map(event => {
        let computedFigure = 0;

        const historyWindowStart = financialData.remaining + kKeyMetricHistoryBars;
        const historyWindowEnd = financialData.remaining;
        const history = new Map<EventTicketCategory, number[]>;

        for (const product of event.products.values()) {
            if (!filter(product))
                continue;

            if (metricType === 'revenue' && !product.price)
                continue;

            if (!history.has(product.category))
                history.set(product.category, [ ...Array(kKeyMetricHistoryBars) ].map(() => 0));

            for (const [ days, sale ] of product.sales.entries()) {
                if (days < financialData.remaining)
                    continue;

                const figure = metricType === 'revenue'
                    ? sale.paid * product.price!
                    : sale.paid + sale.complimentary;

                if (days < historyWindowStart && days >= historyWindowEnd)
                    history.get(product.category)![days - historyWindowEnd] += figure;

                computedFigure += figure;
            }
        }

        const sortedHistory =
            [ ...history.entries() ].sort((lhs, rhs) => lhs[0].localeCompare(rhs[0]));

        const normalisedHistory = sortedHistory.map((entry, index) => ({
            type: 'bar' as const,
            stack: 'total',
            data: entry[1].reverse(),
            label: kSalesCategoryLabels[entry[0]],
            color: kSalesBarColors[index],
        }));

        const historyLabels: string[] = [];
        for (let days = historyWindowStart - 1; days >= historyWindowEnd; --days) {
            historyLabels.push(
                formatDate(financialData.referenceDate.subtract({ days }), 'dddd, MMMM D'));
        }

        const changePercentage = computeChangePercentage(normalisedHistory);

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
 * Computes the 7-day week-over-week change percentage for the normalised history series.
 */
function computeChangePercentage(history: { data: number[] }[]): number | undefined {
    if (!history[0] || history[0].data.length < 2 * kChangePercentageWindow)
        return undefined;

    const currentPeriodFigure = computeTotalFigure(history, 0, kChangePercentageWindow);
    const previousPeriodFigure =
        computeTotalFigure(history, kChangePercentageWindow, 2 * kChangePercentageWindow);

    if (!previousPeriodFigure)
        return undefined;

    const preciseChangePercentage =
        ((currentPeriodFigure - previousPeriodFigure) / previousPeriodFigure) * 100;

    return Math.round(preciseChangePercentage * 10) / 10;
}

/**
 * Computes the total figure across all series for the given `input` between days `start` and `end`.
 */
function computeTotalFigure(input: { data: number[] }[], start: number, end: number): number {
    let totalFigure = 0;

    for (const { data } of input) {
        const startIndex = data.length - start - 1;
        const endIndex = data.length - end - 1;

        for (let index = startIndex; index > endIndex; --index)
            totalFigure += data[index];
    }

    return totalFigure;
}
