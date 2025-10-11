// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { DataGridPro, type DataGridProProps } from '@mui/x-data-grid-pro';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatMetric } from '../kpi/ValueFormatter';
import { NoTicketsOverlay } from './NoProductsOverlay';

/**
 * Information that needs to be known about an individual ticket sales.
 */
export interface TicketSalesDataGridRow {
    /**
     * Unique ID assigned to the product. Required by MUI.
     */
    id: number;

    /**
     * Unique ID of the AnPlan program entry that this product has been associated with.
     */
    programId?: number;

    /**
     * Human-readable name of the product. Should be the primary sorting key.
     */
    product: string;

    /**
     * Maximum number of sales that can be made for this product, if known.
     */
    salesLimit?: number;

    /**
     * Total revenue that has been generated on this event.
     */
    totalRevenue: number;

    /**
     * Current sales of the product, as total number of products sold.
     */
    totalSales: number;
}

/**
 * Props accepted by the <TicketSalesDataGrid> component.
 */
interface TicketSalesDataGridProps {
    /**
     * Rows that should be shown in the DataGrid component.
     */
    rows: TicketSalesDataGridRow[];
}

/**
 * The <EventSalesDataGrid> component wraps a MUI <DataGrid> to display ticket sales information, as
 * made available in the props passed to this component. Client-side logic is used to customise
 * logic and to provide the ability to display detailed sales in an overlay dialog.
 */
export function TicketSalesDataGrid(props: TicketSalesDataGridProps) {
    const [ salesDialogRow, setSalesDialogRow ] = useState<TicketSalesDataGridRow | null>();

    const closeSalesDialog = useCallback(() => setSalesDialogRow(null), [ /* no dependencies */ ]);

    const columns: DataGridProProps<TicketSalesDataGridRow>['columns'] = [
        {
            field: 'product',
            headerName: 'Product',
            flex: 2.5,
        },
        {
            field: 'totalSales',
            headerAlign: 'right',
            headerName: 'Sales',
            align: 'right',
            flex: 1,

            renderCell: params =>
                <Typography variant="inherit">
                    { params.value }
                    { !!params.row.salesLimit &&
                        <Typography component="span" color="textDisabled" variant="inherit">
                            {' '}/ {params.row.salesLimit}
                        </Typography> }
                </Typography>,
        },
        {
            field: 'totalRevenue',
            headerAlign: 'right',
            headerName: 'Revenue',
            align: 'right',
            flex: 1,

            valueFormatter: v => formatMetric(v, 'revenue'),
        },
        {
            display: 'flex',
            field: 'id',
            headerAlign: 'right',
            headerName: /* empty= */ '',
            sortable: false,
            width: 50,

            renderCell: params =>
                <Tooltip title="Display sales graph">
                    <IconButton size="small" color="info" disabled
                                onClick={ () => setSalesDialogRow(params.row) }>
                        <ShowChartIcon fontSize="small" />
                    </IconButton>
                </Tooltip>,
        },
    ];

    return (
        <>
            <DataGridPro density="compact" disableColumnMenu disableColumnReorder
                         disableColumnResize hideFooter columns={columns} rows={props.rows}
                         slots={{
                             noRowsOverlay: NoTicketsOverlay,
                         }}
                         sx={{
                             '--DataGrid-overlayHeight': '120px',  // increase empty-state height
                             borderColor: 'transparent',  // remove the grid's default border
                         }} />
            { !!salesDialogRow &&
                <Dialog open onClose={closeSalesDialog} maxWidth="md" fullWidth>
                    <DialogTitle>
                        {salesDialogRow.product}
                    </DialogTitle>
                    <DialogContent>
                        Graphs to follow
                    </DialogContent>
                    <DialogActions sx={{ pt: 0, mr: 1, mb: 0, pl: 2 }}>
                        <Button onClick={closeSalesDialog} variant="text">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog> }
        </>
    );
}
