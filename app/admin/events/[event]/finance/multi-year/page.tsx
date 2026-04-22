// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// TODO: Integrate this in the Finance pages somehow.

import Link from '@app/LinkProxy';

import { BarChartPro } from '@proxy/mui-x-charts-premium';

import { default as MuiLink } from '@mui/material/Link';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEvents, tEventsSales, tEventsSalesConfiguration } from '@lib/database';
import { kEventSalesCategory } from '@lib/database/Types';

/**
 * The <MultiYearFinancePage> component displays raw information for a multi-year sales comparison,
 * based on total ticket sales for N days prior to the convention's start.
 */
export default async function MultiYearFinancePage(
    props: PageProps<'/admin/events/[event]/finance/multi-year'>)
{
    await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'statistics.finances',
    });

    const params = await props.searchParams;

    const kDaysToCompare =
        Object.hasOwn(params, 'days') ? parseInt(params['days'] as string, 10) : 28;

    const kEventsForComparison = [ 13, 14, 15 ];

    const kDataType: 'Revenue' | 'Sales' =
        Object.hasOwn(params, 'type') ? params['type'] as 'Revenue' | 'Sales' : 'Sales';

    const dbInstance = db;

    const mostRecentEvents = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.in(kEventsForComparison))
        .select({
            id: tEvents.eventId,
            name: tEvents.eventShortName,
            slug: tEvents.eventSlug,

            start: tEvents.eventStartTime,
            end: tEvents.eventEndTime,
        })
        .orderBy('start', 'desc')
        .executeSelectMany();

    const mostRecentEventsMap = new Map(mostRecentEvents.map(event => [
        event.id,
        {
            ...event,
            startDate: event.start.toPlainDate(),
            endDate: event.end.toPlainDate(),
        }
    ]));

    const salesData = await dbInstance.selectFrom(tEventsSales)
        .innerJoin(tEventsSalesConfiguration)
            .on(tEventsSalesConfiguration.saleId.equals(tEventsSales.eventSaleId))
        .where(tEventsSales.eventId.in(mostRecentEvents.map(event => event.id)))
            .and(tEventsSalesConfiguration.saleCategory.in([
                kEventSalesCategory.TicketFriday,
                kEventSalesCategory.TicketSaturday,
                kEventSalesCategory.TicketSunday,
                kEventSalesCategory.TicketWeekend,
            ]))
        .select({
            date: tEventsSales.eventSaleDate,
            eventId: tEventsSales.eventId,
            category: tEventsSalesConfiguration.saleCategory,
            sales: tEventsSales.eventSaleCount,
            revenue: tEventsSales.eventSaleCount.multiply(tEventsSalesConfiguration.salePrice),
        })
        .executeSelectMany();

    type SalesDataForYear<Year extends string> = {
        [K in `${Year}_fridaySales` |
              `${Year}_fridayRevenue` |
              `${Year}_saturdaySales` |
              `${Year}_saturdayRevenue` |
              `${Year}_sundaySales` |
              `${Year}_sundayRevenue` |
              `${Year}_weekendSales` |
              `${Year}_weekendRevenue`]: string;
    };

    type SalesData = { days: number } &
                     SalesDataForYear<'2024'> &
                     SalesDataForYear<'2025'> &
                     SalesDataForYear<'2026'> & {};

    const kSalesDataRowTemplate: any = {};
    const kSalesDataSeries: any = [];

    const kColors = {
        '2026friday': '#0079bc',
        '2026saturday': '#009eea',
        '2026sunday': '#5fbe87',
        '2026weekend': '#c1e13e',

        '2025friday': '#ff6f00',
        '2025saturday': '#ffa000',
        '2025sunday': '#ffc107',
        '2025weekend': '#ffd54f',

        '2024friday': '#311b92',
        '2024saturday': '#512da8',
        '2024sunday': '#673ab7',
        '2024weekend': '#9575cd',

    } as const;

    for (const event of [ '2024', '2025', '2026' ] as const) {
        for (const category of [ 'friday', 'saturday', 'sunday', 'weekend' ] as const) {
            kSalesDataSeries.push({
                dataKey: `${event}_${category}${kDataType}`,
                label: `${event} (${category[0].toUpperCase() + category.slice(1)})`,
                color: kColors[`${event}${category}`],
                stack: event,
            });

            for (const type of [ 'Sales', 'Revenue' ])
                kSalesDataRowTemplate[`${event}_${category}${type}`] = 0;
        }
    }

    const computedSalesData: Map<number, SalesData> = new Map();
    for (let daysRemaining = 0; daysRemaining < kDaysToCompare; ++daysRemaining) {
        computedSalesData.set(daysRemaining, {
            days: daysRemaining,
            ...kSalesDataRowTemplate,
        });
    }

    for (const data of salesData) {
        const event = mostRecentEventsMap.get(data.eventId);
        if (!event)
            throw new Error(`Unrecognised EventID found: ${data.eventId}`);

        const days = event.endDate.since(data.date, { largestUnit: 'days' }).days;
        if (days < 0)
            continue; // throw new Error(`Date constraint violated: ${event.endDate} / ${data.date} / ${days}}`);

        if (days >= kDaysToCompare)
            continue;  // out of range

        let category: string;
        switch (data.category) {
            case kEventSalesCategory.TicketFriday:
                category = 'friday';
                break;

            case kEventSalesCategory.TicketSaturday:
                category = 'saturday';
                break;

            case kEventSalesCategory.TicketSunday:
                category = 'sunday';
                break;

            case kEventSalesCategory.TicketWeekend:
                category = 'weekend';
                break;

            default:
                throw new Error(`Unrecognised category found: ${data.category}`);
        }

        const revenueKey = `${event.slug}_${category}Revenue`;
        const salesKey = `${event.slug}_${category}Sales`;

        const object = computedSalesData.get(days) as any;
        object[revenueKey] += data.revenue;
        object[salesKey] += data.sales;
    }

    const sortedComputedSalesData =
        [ ...computedSalesData.values() ].sort((a, b) => b.days - a.days);

    return (
        <Section title="Multi-year financial overview">
            <SectionIntroduction>
                This page contains raw information that enables a multi-year comparison of ticket
                sales to be made. This should be integrated in the dashboard in the future.
            </SectionIntroduction>
            <SectionIntroduction>
                Filter by:{' '}
                <MuiLink component={Link} href="?days=28">Days (28)</MuiLink>,{' '}
                <MuiLink component={Link} href="?type=Revenue&days=28">Revenue</MuiLink>,{' '}
                <MuiLink component={Link} href="?type=Sales&days=28">Sales</MuiLink>.
            </SectionIntroduction>
            <BarChartPro
                dataset={sortedComputedSalesData}
                series={kSalesDataSeries}
                xAxis={[ { dataKey: 'days' } ]} />
        </Section>
    );
}
