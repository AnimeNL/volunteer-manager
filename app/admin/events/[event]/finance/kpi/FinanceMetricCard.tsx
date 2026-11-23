// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FinanceProcessor } from '../FinanceProcessor';
import { KeyMetricCard } from './KeyMetricCard';
import { KeyMetricGraph } from './KeyMetricGraph';

/**
 * Configuration for each supported finance KPI metric card.
 */
const kFinanceMetrics = {
    'event-revenue': {
        format: 'revenue',
        title: 'Event ticket revenue',
        view: 'eventTicketRevenueView',
    },
    'event-sales': {
        format: 'sales',
        subject: 'tickets',
        title: 'Event ticket sales',
        view: 'eventTicketSalesView',
    },
    'ticket-revenue': {
        format: 'revenue',
        title: 'Ticket revenue',
        view: 'ticketRevenueView',
    },
    'ticket-sales': {
        format: 'sales',
        subject: 'tickets',
        title: 'Ticket sales',
        view: 'ticketSalesView',
    },
} as const;

/**
 * Props accepted by the <FinanceMetricCard> component.
 */
interface FinanceMetricCardProps {
    /**
     * Which financial KPI metric to display.
     */
    metric: keyof typeof kFinanceMetrics;

    /**
     * The financial processor that contains the relevant ticket sale information.
     */
    processor: FinanceProcessor;
}

/**
 * Displays a single financial KPI card (sales volume or revenue) with its historical trend graph.
 */
export function FinanceMetricCard(props: FinanceMetricCardProps) {
    const config = kFinanceMetrics[props.metric];
    const [ headline, ...historical ] = props.processor[config.view];
    if (!headline)
        return null;

    return (
        <KeyMetricCard title={config.title} format={config.format} headline={headline}
                       historical={historical} remainingDays={props.processor.remainingDays}
                       subject={'subject' in config ? config.subject : undefined}>
            <KeyMetricGraph labels={headline.history.labels} series={headline.history.data}
                            type={config.format} />
        </KeyMetricCard>
    );
}
