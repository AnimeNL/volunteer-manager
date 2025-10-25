// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';

import type { FinanceProcessor } from '../FinanceProcessor';
import { SalesDataGrid } from './SalesDataGrid';

/**
 * Props accepted by the <EventSalesTable> component.
 */
interface EventSalesTableProps {
    /**
     * Whether program-associated entries should link through to their respective pages.
     */
    disableProductLinks?: boolean;

    /**
     * The financial processor that contains the relevant ticket sale information.
     */
    processor: FinanceProcessor;
}

/**
 * The <EventSalesTable> component displays a MUI X DataTable specific to sales of event tickets.
 * It displays th ticketable events, their high level sales information, and progression graphs.
 */
export function EventSalesTable(props: EventSalesTableProps) {
    return (
        <Card elevation={1}>
            <SalesDataGrid disableProductLinks={props.disableProductLinks} kind="events"
                           rows={props.processor.eventSalesTableView} />
        </Card>
    );
}
