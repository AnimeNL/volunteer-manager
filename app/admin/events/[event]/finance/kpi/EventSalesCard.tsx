// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { FinanceProcessor } from '../FinanceProcessor';
import { KeyMetricCard } from './KeyMetricCard';
import { KeyMetricGraph } from './KeyMetricGraph';

/**
 * Props accepted by the <EventSalesCard> component.
 */
interface EventSalesCardProps {
    /**
     * The financial processor that contains the relevant ticket sale information.
     */
    processor: FinanceProcessor;
}

/**
 * The <EventSalesCard> component displays the event ticket sales (volume) KPI card.
 */
export function EventSalesCard(props: EventSalesCardProps) {
    const view = props.processor.eventTicketSalesView;

    const [ headline, ...historical ] = view;

    return (
        <KeyMetricCard title="Event ticket sales" format="sales" headline={headline}
                       historical={historical} remainingDays={props.processor.remainingDays}
                       subject="tickets">
            <KeyMetricGraph labels={headline.history.labels} series={headline.history.data}
                            type="sales" />
        </KeyMetricCard>
    );
}
