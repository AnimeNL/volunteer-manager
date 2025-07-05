// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FinanceProcessor } from '../FinanceProcessor';
import { KeyMetricCard } from './KeyMetricCard';
import { KeyMetricGraph } from './KeyMetricGraph';

/**
 * Props accepted by the <TicketSalesCard> component.
 */
interface TicketSalesCardProps {
    /**
     * The financial processor that contains the relevant ticket sale information.
     */
    processor: FinanceProcessor;
}

/**
 * The <TicketSalesCard> component displays the ticket sale (volume) KPI card.
 */
export function TicketSalesCard(props: TicketSalesCardProps) {
    const view = props.processor.ticketSalesView;

    const headline = view.shift()!;
    const historical = view;

    return (
        <KeyMetricCard title="Ticket sales" format="sales" headline={headline}
                       historical={historical} remainingDays={props.processor.remainingDays}
                       subject="tickets">
            <KeyMetricGraph labels={headline.history.labels} series={headline.history.data}
                            type="sales" />
        </KeyMetricCard>
    );
}
