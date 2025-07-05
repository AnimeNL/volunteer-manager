// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FinanceProcessor } from '../FinanceProcessor';
import { KeyMetricCard } from './KeyMetricCard';
import { KeyMetricGraph } from './KeyMetricGraph';

/**
 * Props accepted by the <TicketRevenueCard> component.
 */
interface TicketRevenueCardProps {
    /**
     * The financial processor that contains the relevant ticket sale information.
     */
    processor: FinanceProcessor;
}

/**
 * The <TicketRevenueCard> component displays the ticket revenue KPI card.
 */
export function TicketRevenueCard(props: TicketRevenueCardProps) {
    const view = props.processor.ticketRevenueView;

    const headline = view.shift()!;
    const historical = view;

    return (
        <KeyMetricCard title="Ticket revenue" format="revenue" headline={headline}
                       historical={historical} remainingDays={props.processor.remainingDays}>
            <KeyMetricGraph labels={headline.history.labels} series={headline.history.data}
                            type="revenue" />
        </KeyMetricCard>
    );
}
