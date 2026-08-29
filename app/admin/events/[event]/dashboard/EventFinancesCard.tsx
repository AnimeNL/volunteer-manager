// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';

import type { CachedEvent } from '@lib/cache';
import { FinanceProcessor } from '../finance/FinanceProcessor';
import { TicketRevenueCard } from '../finance/kpi/TicketRevenueCard';
import { TicketSalesCard } from '../finance/kpi/TicketSalesCard';

/**
 * Props accepted by the <EventFinancesCard> component.
 */
interface EventFinancesCardProps {
    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;
}

/**
 * Event dashboard cards that show ticket sales and revenue for consumption at a quick glance.
 */
export async function EventFinancesCard(props: EventFinancesCardProps) {
    const processor = await FinanceProcessor.getOrCreateForEvent(props.event.slug);
    if (!processor)
        return null;

    return (
        <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, lg: 6 }}>
                <TicketRevenueCard processor={processor} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
                <TicketSalesCard processor={processor} />
            </Grid>
        </Grid>
    );
}
