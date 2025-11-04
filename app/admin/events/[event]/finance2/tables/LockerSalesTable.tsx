// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';

import type { FinanceProcessor } from '../FinanceProcessor';
import { SalesDataGrid } from './SalesDataGrid';

/**
 * Props accepted by the <LockerSalesTable> component.
 */
interface LockerSalesTableProps {
    /**
     * The financial processor that contains the relevant locker sale information.
     */
    processor: FinanceProcessor;
}

/**
 * The <LockerSalesTable> component displays a MUI X DataTable specific to sales of lockers.
 */
export function LockerSalesTable(props: LockerSalesTableProps) {
    return (
        <Card elevation={1}>
            <SalesDataGrid kind="lockers" rows={props.processor.lockerSalesTableView} />
        </Card>
    );
}
