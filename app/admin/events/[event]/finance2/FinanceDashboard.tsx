// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

import { EventRevenueCard } from './kpi/EventRevenueCard';
import { EventSalesCard } from './kpi/EventSalesCard';
import { FinanceProcessor } from './FinanceProcessor';
import { LockerSalesGraph } from './graphs/LockerSalesGraph';
import { SalesDataGrid } from './SalesDataGrid';
import { TicketRevenueCard } from './kpi/TicketRevenueCard';
import { TicketSalesCard } from './kpi/TicketSalesCard';
import { VisitorGraphCard } from './graphs/VisitorGraphCard';

/**
 * Props accepted by the <FinanceDashboard> component.
 */
interface FinanceDashboardProps {
    /**
     * Whether program-associated entries should link through to their respective pages.
     */
    disableProductLinks?: boolean;

    /**
     * URL-safe slug of the event for which financial information should be shown.
     */
    event: string;
}

/**
 * The <FinanceDashboard> component contains the financial dashboard for a certain event, sharing
 * the key metrics that are relevant to those dealing with the event's financial situation.
 */
export async function FinanceDashboard(props: FinanceDashboardProps) {
    const processor = await FinanceProcessor.getOrCreateForEvent(props.event);
    if (!processor) {
        return (
            <Paper component={Alert} severity="error">
                There's no financial information available for this edition at the moment.
            </Paper>
        );
    }

    // Aspect ratio to apply to the pie chart containers.
    const kPieChartAspectRatio = 1.8;

    // TODO: Graphs for each of the row items in <TicketSalesTable>
    // TODO: Graphs for each of the row items in <LockerSalesTable>
    // TODO: Graphs for each of the row items in <EventSalesTable>

    return (
        <Grid container spacing={2}>

            { /** Section: KPI overview ------------------------------------------------------- */ }

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TicketSalesCard processor={processor} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TicketRevenueCard processor={processor} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <EventSalesCard processor={processor} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <EventRevenueCard processor={processor} />
            </Grid>

            { /** Section: Festival sales ----------------------------------------------------- */ }

            <Grid size={{ xs: 12, md: 6 }}>
                <Grid container spacing={2}>

                    { /** Section: Tickets ---------------------------------------------------- */ }

                    <Grid size={{ xs: 12 }}>
                        <Card elevation={1}>
                            <SalesDataGrid kind="tickets" rows={processor.ticketSalesTableView} />
                        </Card>
                    </Grid>

                    { /** Section: Graphs ------------------------------------------------------ */}

                    <Grid size={{ xs: 12, md: 6 }}>
                        <VisitorGraphCard aspectRatio={kPieChartAspectRatio}
                                          processor={processor} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <LockerSalesGraph aspectRatio={kPieChartAspectRatio}
                                          processor={processor} />
                    </Grid>

                    { /** Section: Lockers ---------------------------------------------------- */ }

                    <Grid size={{ xs: 12 }}>
                        <Card elevation={1}>
                            <SalesDataGrid kind="lockers" rows={processor.lockerSalesTableView} />
                        </Card>
                    </Grid>

                </Grid>
            </Grid>

            { /** Section: Event sales -------------------------------------------------------- */ }

            <Grid size={{ xs: 12, md: 6 }}>
                <Card elevation={1}>
                    <SalesDataGrid disableProductLinks={props.disableProductLinks} kind="events"
                                   rows={processor.eventSalesTableView} />
                </Card>
            </Grid>

        </Grid>
    );
}
