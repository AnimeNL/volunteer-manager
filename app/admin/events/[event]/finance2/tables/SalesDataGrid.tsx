// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { DataGridPro, type DataGridProProps } from '@mui/x-data-grid-pro';

import { default as MuiLink } from '@mui/material/Link';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatMetric } from '../kpi/ValueFormatter';

/**
 * Information that needs to be known about an individual sales.
 */
export interface SalesDataGridRow {
    /**
     * Unique ID assigned to the product. Required by MUI.
     */
    id: number;

    /**
     * Link of the page that this product should link to.
     */
    href?: string;

    /**
     * Human-readable name of the product. Should be the primary sorting key.
     */
    product: string;

    /**
     * Total revenue that has been generated on this event.
     */
    totalRevenue: number;

    /**
     * Current sales of the product, as total number of products sold.
     */
    totalSales: number;

    /**
     * Maximum number of sales that can be made for this product, if known.
     */
    maximumSales?: number;
}

/**
 * Props accepted by the <TicketSalesDataGrid> component.
 */
interface SalesDataGridProps {
    /**
     * Whether product links should be disabled, even if a valid `href` has been passed.
     */
    disableProductLinks?: boolean;

    /**
     * Kind of products displayed by this data table.
     */
    kind: 'events' | 'lockers' | 'tickets';

    /**
     * Rows that should be shown in the DataGrid component.
     */
    rows: SalesDataGridRow[];
}

/**
 * The <SalesDataGrid> component wraps a MUI <DataGrid> to display sales information for a series of
 * products, with various customisation options available. Client-side logic is used to customise
 * logic and to provide the ability to display detailed sales in an overlay dialog.
 */
export function SalesDataGrid(props: SalesDataGridProps) {
    const [ salesDialogRow, setSalesDialogRow ] = useState<SalesDataGridRow | null>();

    const closeSalesDialog = useCallback(() => setSalesDialogRow(null), [ /* no dependencies */ ]);

    const columns: DataGridProProps<SalesDataGridRow>['columns'] = [
        {
            field: 'product',
            headerName: 'Product',
            flex: 2.5,

            renderCell: params => {
                if (props.disableProductLinks || !params.row.href)
                    return params.value;

                return (
                    <MuiLink component={Link} href={params.row.href}>
                        {params.value}
                    </MuiLink>
                );
            },
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
                    { !!params.row.maximumSales &&
                        <Typography component="span" color="textDisabled" variant="inherit">
                            {' '}/ {params.row.maximumSales}
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

    const noRowsOverlay = useMemo(() => {
        switch (props.kind) {
            case 'events':
                return OverlayWithoutLabel.bind(null, 'Event tickets will appear here…');
            case 'lockers':
                return OverlayWithoutLabel.bind(null, 'Lockers will appear here…');
            case 'tickets':
                return OverlayWithoutLabel.bind(null, 'Tickets will appear here…');
        }

        throw new Error(`Invalid |kind| prop passed: ${props.kind}`)

    }, [ props.kind ]);

    return (
        <>
            <DataGridPro density="compact" disableColumnMenu disableColumnReorder
                         disableColumnResize hideFooter columns={columns} rows={props.rows}
                         slots={{ noRowsOverlay }}
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

/**
 * Overlay used in the MUI Data Grid component when no products could be found, which is quite
 * commonly the case early on during festival organisation.
 */
function OverlayWithoutLabel(label: string) {
    return (
        <Stack direction="column" alignItems="center" justifyContent="center"
               sx={{ height: '100%' }}>
            <LocalActivityIcon color="disabled" fontSize="large" />
            <Typography color="textDisabled" variant="body2">
                {label}
            </Typography>
        </Stack>
    );
}
