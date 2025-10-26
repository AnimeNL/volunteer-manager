// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

import { type EventSalesGraphProps, EventSalesGraph } from './graphs/EventSalesGraph';
import { type TicketSalesGraphProps, TicketSalesGraph } from './graphs/TicketSalesGraph';
import { TicketSalesTopLineGraph } from './graphs/TicketSalesTopLineGraph';
import { LoadingGraph } from './graphs/LoadingGraph';
import { Section } from '@app/admin/components/Section';
import { selectRangeForEvent } from './graphs/SalesGraphUtils';
import db, { tEventsSalesConfiguration } from '@lib/database';

import { kEventSalesCategory } from '@lib/database/Types';

/**
 * Props accepted by the <FinanceGraphGrid> component.
 */
interface FinanceGraphGridProps {
    /**
     * Whether links to associated events should be disabled.
     */
    disableEventLinks?: boolean;

    /**
     * Unique ID of the event for which graphs should be shown.
     */
    eventId: number;

    /**
     * Whether the grid should include a graph on combined ticket revenue.
     */
    includeTicketRevenue?: boolean;
}

/**
 * The <FinanceGraphGrid> component displays a grid with a series of financial graphs related to a
 * particular event. No access checks are performed by this component.
 */
export async function FinanceGraphGrid(props: FinanceGraphGridProps) {
    const { disableEventLinks, eventId } = props;

    // ---------------------------------------------------------------------------------------------
    // Determine the date ranges that should be displayed on the graphs. All graphs will show data
    // along the same X axes to make sure that they're visually comparable.

    const range = await selectRangeForEvent(eventId);

    // ---------------------------------------------------------------------------------------------
    // Determine that graphs that have to be displayed. This is depending on the configuration that
    // has been set for the event. Ticket graphs will be displayed before event graphs.

    const dbInstance = db;

    const graphs = await dbInstance.selectFrom(tEventsSalesConfiguration)
        .where(tEventsSalesConfiguration.eventId.equals(eventId))
            .and(tEventsSalesConfiguration.saleCategory.isNotNull())
        .select({
            category: tEventsSalesConfiguration.saleCategory,
            categoryLimit: tEventsSalesConfiguration.saleCategoryLimit,
            products: dbInstance.aggregateAsArray({
                id: tEventsSalesConfiguration.saleId,
                label: tEventsSalesConfiguration.saleProduct,
            }),
            saleEventId: tEventsSalesConfiguration.saleEventId,
        })
        .groupBy(tEventsSalesConfiguration.saleCategory, tEventsSalesConfiguration.saleEventId)
        .executeSelectMany();

    let ticketCategoriesFound: boolean = false;

    const eventGraphs: EventSalesGraphProps[] = [ /* no graphs */ ];
    const lockerGraphs: EventSalesGraphProps[] = [ /* no graphs */ ];
    const ticketGraphs: TicketSalesGraphProps[] = [ /* no graphs */ ];

    for (const graph of graphs) {
        graph.products.sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

        switch (graph.category) {
            case kEventSalesCategory.Event:
                eventGraphs.push({
                    activityId: graph.saleEventId,
                    category: graph.category,
                    disableEventLinks,
                    eventId: eventId,
                    limit: graph.categoryLimit,
                    products: graph.products,
                    range,
                });
                break;

            case kEventSalesCategory.Hidden:
                break;

            case kEventSalesCategory.Locker:
            case kEventSalesCategory.LockerFriday:
            case kEventSalesCategory.LockerSaturday:
            case kEventSalesCategory.LockerSunday:
            case kEventSalesCategory.LockerWeekend:
                lockerGraphs.push({
                    category: kEventSalesCategory.Locker,
                    eventId: eventId,
                    products: graph.products,
                    range,
                    title: 'Lockers',
                });
                break;

            case kEventSalesCategory.TicketFriday:
            case kEventSalesCategory.TicketSaturday:
            case kEventSalesCategory.TicketSunday:
            case kEventSalesCategory.TicketWeekend:
                ticketCategoriesFound = true;
                ticketGraphs.push({
                    category: graph.category,
                    eventId: eventId,
                    products: graph.products,
                    range,
                });
                break;

            default:
                console.warn(`Unrecognised graph category: ${graph.category}`);
                break;
        }
    }

    for (const graph of lockerGraphs)
        eventGraphs.unshift(graph);

    // ---------------------------------------------------------------------------------------------

    return (
        <Grid container spacing={2}>
            { ticketCategoriesFound &&
                <Grid size={{ xs: !!props.includeTicketRevenue ? 6 : 12 }}>
                    <Section noHeader>
                        <TicketSalesTopLineGraph eventId={eventId} title="Combined ticket sales" />
                    </Section>
                </Grid> }
            { (ticketCategoriesFound && props.includeTicketRevenue) &&
                <Grid size={6}>
                    <Section noHeader>
                        <TicketSalesTopLineGraph eventId={eventId} revenue
                                                 title="Combined ticket revenue" />
                    </Section>
                </Grid> }
            { ticketGraphs.map((ticketGraphProps, index) =>
                <Grid key={index} size={{ xs: 12, md: 6 }}>
                    <Section noHeader>
                        <Suspense fallback={ <LoadingGraph /> }>
                            <TicketSalesGraph {...ticketGraphProps} />
                        </Suspense>
                    </Section>
                </Grid> )}
            { eventGraphs.map((eventGraphProps, index) =>
                <Grid key={index} size={{ xs: 12, md: 6 }}>
                    <Section noHeader>
                        <Suspense fallback={ <LoadingGraph /> }>
                            <EventSalesGraph {...eventGraphProps} />
                        </Suspense>
                    </Section>
                </Grid> )}
            { (!ticketGraphs.length && !eventGraphs.length) &&
                <Grid size={12}>
                    <Paper elevation={1} sx={{ p: 1.75 }}>
                        <Alert severity="error" variant="outlined">
                            No financial information is available, or has been configured for
                            this event yet.
                        </Alert>
                    </Paper>
                </Grid> }
        </Grid>
    );
}
