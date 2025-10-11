// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

import { EventRevenueCard } from './kpi/EventRevenueCard';
import { EventSalesCard } from './kpi/EventSalesCard';
import { EventSalesTable } from './tables/EventSalesTable';
import { FinanceProcessor } from './FinanceProcessor';
import { LockerSalesTable } from './tables/LockerSalesTable';
import { TicketRevenueCard } from './kpi/TicketRevenueCard';
import { TicketSalesCard } from './kpi/TicketSalesCard';
import { TicketSalesTable } from './tables/TicketSalesTable';

/**
 * Props accepted by the <FinanceDashboard> component.
 */
interface FinanceDashboardProps {
    /**
     * Whether program-associated entries should link through to their respective pages.
     */
    enableProgramLinks?: boolean;

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

    // TODO: Unify the components between <{Event,Locker,Ticket}SalesTable>
    // TODO: Unify the processors between <{Event,Locker,Ticket}SalesTable> functions

    // TODO: Graph displaying ticket sales and estimated visitors per day
    // TODO: Graph displaying locker sales

    // TODO: Group days together in <TicketSalesTable>
    // TODO: Graphs for each of the row items in <TicketSalesTable>

    // TODO: Group days together in <LockerSalesTable>
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
                        <TicketSalesTable processor={processor} />
                    </Grid>

                    { /* Graph: Tickets + visitors / day (two-layer pie chart) */ }

                    { /** Section: Lockers ---------------------------------------------------- */ }

                    { /* Graph: Locker sales (pie chart) */ }

                    <Grid size={{ xs: 12 }}>
                        <LockerSalesTable processor={processor} />
                    </Grid>

                </Grid>
            </Grid>

            { /** Section: Event sales -------------------------------------------------------- */ }

            <Grid size={{ xs: 12, md: 6 }}>
                <EventSalesTable enableProgramLinks={props.enableProgramLinks}
                                 processor={processor} />
            </Grid>

        </Grid>
    );
}
