// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import { DataGridPro, type DataGridProProps } from '@mui/x-data-grid-pro';

import { default as MuiLink } from '@mui/material/Link';
import CheckIcon from '@mui/icons-material/Check';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import IconButton from '@mui/material/IconButton';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatMetric } from '../kpi/ValueFormatter';

/**
 * Information that needs to be known about an individual product sales.
 */
export interface EventSalesDataGridRow {
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
 * Props accepted by the <EventSalesDataGrid> component.
 */
interface EventSalesDataGridProps {
    /**
     * Whether program-associated entries should link through to their respective pages.
     */
    enableProgramLinks?: boolean;

    /**
     * Rows that should be shown in the DataGrid component.
     */
    rows: EventSalesDataGridRow[];
}

/**
 * The <EventSalesDataGrid> component wraps a MUI <DataGrid> to display event sales information, as
 * made available in the props passed to this component. Client-side logic is used to customise
 * logic and to provide the ability to display detailed sales in an overlay dialog.
 */
export function EventSalesDataGrid(props: EventSalesDataGridProps) {
    const columns: DataGridProProps<EventSalesDataGridRow>['columns'] = [
        {
            field: 'product',
            headerName: 'Product',
            flex: 2.5,

            renderCell: params => {
                if (!props.enableProgramLinks || !params.row.programId)
                    return params.value;

                return (
                    <MuiLink component={Link} href={`./program/activities/${params.row.programId}`}>
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
                <>
                    <Typography variant="inherit">
                        { (!!params.row.salesLimit && params.row.salesLimit <= params.value) &&
                            <Typography component="span" color="success" variant="inherit">
                                <CheckIcon fontSize="inherit"
                                           sx={{ mr: 0.5, transform: 'translateY(2px)' }} />
                            </Typography> }
                        { params.value }
                        { !!params.row.salesLimit &&
                            <Typography component="span" color="textDisabled" variant="inherit">
                                {' '}/ {params.row.salesLimit}
                            </Typography> }
                    </Typography>
                </>,
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
                    <IconButton size="small" color="info">
                        <ShowChartIcon fontSize="small" />
                    </IconButton>
                </Tooltip>,
        },
    ];

    return (
        <DataGridPro density="compact" disableColumnMenu disableColumnReorder disableColumnResize
                     hideFooter columns={columns} rows={props.rows}
                     slots={{
                         noRowsOverlay: NoProductsOverlay,
                     }}
                     sx={{
                        '--DataGrid-overlayHeight': '120px',  // increase empty-state height
                        borderColor: 'transparent',  // remove the grid's default border
                     }} />
    );
}

/**
 * Overlay used in the MUI DataGrid component when no products could be found, which is quite
 * commonly the case early on during festival organisation.
 */
function NoProductsOverlay() {
    return (
        <Stack direction="column" alignItems="center" justifyContent="center"
               sx={{ height: '100%' }}>
            <LocalActivityIcon color="disabled" fontSize="large" />
            <Typography color="textDisabled" variant="body2">
                Event tickets will appear here…
            </Typography>
        </Stack>
    );
}
