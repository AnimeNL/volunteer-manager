// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';

import type { FinanceProcessor } from '../FinanceProcessor';
import { SalesDataGrid } from './SalesDataGrid';

/**
 * Props accepted by the <TicketSalesTable> component.
 */
interface TicketSalesTableProps {
    /**
     * The financial processor that contains the relevant ticket sale information.
     */
    processor: FinanceProcessor;
}

/**
 * The <TicketSalesTable> component displays a MUI X DataTable specific to sales of tickets.
 */
export function TicketSalesTable(props: TicketSalesTableProps) {
    return (
        <Card elevation={1}>
            <SalesDataGrid kind="tickets" rows={props.processor.ticketSalesTableView} />
        </Card>
    );
}
