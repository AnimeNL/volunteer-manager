// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { DataGridPro, GRID_TREE_DATA_GROUPING_FIELD, type DataGridProProps } from '@mui/x-data-grid-pro';

import { default as MuiLink } from '@mui/material/Link';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VerifiedIcon from '@mui/icons-material/Verified';

import { SalesDataGridGroupingCell } from './SalesDataGridGroupingCell';
import { formatMetric } from './kpi/ValueFormatter';

import { kEventSalesCategory, type EventSalesCategory } from '@lib/database/Types';

/**
 * Optional category labels to translate to a human readable name. Falls back to the category name.
 */
const kCategoryLabels: { [key in EventSalesCategory]?: string } = {
    [kEventSalesCategory.LockerFriday]: 'Friday lockers',
    [kEventSalesCategory.LockerSaturday]: 'Saturday lockers',
    [kEventSalesCategory.LockerSunday]: 'Sunday lockers',
    [kEventSalesCategory.LockerWeekend]: 'Weekend lockers',
    [kEventSalesCategory.TicketFriday]: 'Friday tickets',
    [kEventSalesCategory.TicketSaturday]: 'Saturday tickets',
    [kEventSalesCategory.TicketSunday]: 'Sunday tickets',
    [kEventSalesCategory.TicketWeekend]: 'Weekend tickets',
};

/**
 * Returns the tree data path for category grouping as supported by the <SalesDataGrid> component.
 */
function getTreeDataPathForCategories(row: SalesDataGridRow): string[] {
    const categoryLabel = kCategoryLabels[row.category as EventSalesCategory] ?? row.category;
    return (row.id <= 0 || row.avoidCategoryAggregation)
        ? [ categoryLabel ]
        : [ categoryLabel, row.product ];
}

/**
 * Information that needs to be known about an individual sales.
 */
export interface SalesDataGridRow {
    /**
     * Unique ID assigned to the product. Required by MUI.
     */
    id: number;

    /**
     * Category that the row is part of. Used for the optional grouping feature.
     */
    category: string;

    /**
     * Link of the page that this product should link to.
     */
    href?: string;

    /**
     * Human-readable name of the product. Should be the primary sorting key.
     */
    product: string;

    /**
     * When given, will enable a tooltip to display the individual product price.
     */
    price?: number;

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

    /**
     * Internal property to signal that aggregation by category should be avoided, as this row has
     * been identified as being the only one within a particular category.
     *
     * @ignore
     */
    avoidCategoryAggregation?: true;
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

    const columnDefinitions: DataGridProProps<SalesDataGridRow>['columns'] = useMemo(() => [
        {
            field: 'product',
            headerName: 'Product',
            flex: 3,

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
                    { params.row.maximumSales === params.row.totalSales &&
                        <Tooltip title="Sold out!">
                            <VerifiedIcon fontSize="inherit" color="success"
                                          sx={{ mr: 0.75, transform: 'translateY(2px)' }} />
                        </Tooltip> }
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

            renderCell: params =>
                <Typography variant="inherit">
                    { !!params.row.price &&
                        <Tooltip title={ formatMetric(params.row.price, 'revenue', 'each') }>
                            <SellOutlinedIcon fontSize="inherit" color="info"
                                              sx={{ mr: 0.75, transform: 'translateY(2px)' }} />
                        </Tooltip> }
                    { formatMetric(params.value, 'revenue') }
                </Typography>,
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
    ], [ props.disableProductLinks ]);

    // ---------------------------------------------------------------------------------------------

    const [ rows, requiresCategoryGrouping ] = useMemo(() => {
        const categoryTally = new Map<string, number>;
        for (const { category } of props.rows)
            categoryTally.set(category, 1 + (categoryTally.get(category) ?? 0));

        const categoryAggregates = new Map<string, SalesDataGridRow>;
        for (const [ category, tally ] of categoryTally.entries()) {
            if (tally === 1) continue;  // avoid aggregate rows for single-product categories

            categoryAggregates.set(category, {
                id: 0 - categoryAggregates.size,
                category,
                // |href| intentionally omitted
                product: kCategoryLabels[category as EventSalesCategory] ?? category,
                totalRevenue: 0,
                totalSales: 0,
                // |maximumSales| intentionally omitted
            });
        }

        for (const row of props.rows) {
            const aggregate = categoryAggregates.get(row.category);
            if (aggregate) {
                aggregate.href ??= row.href;
                aggregate.totalRevenue += row.totalRevenue;
                aggregate.totalSales += row.totalSales;
            } else {
                row.avoidCategoryAggregation = true;
            }
        }

        return [
            [
                ...categoryAggregates.values(),
                ...props.rows,
            ].sort((lhs, rhs) => lhs.product.localeCompare(rhs.product)),
            /* requiresCategoryGrouping= */ categoryAggregates.size > 0
        ];

    }, [ props.rows ]);

    const [ columns, groupingColDef ] = useMemo(() => {
        if (!requiresCategoryGrouping)
            return [ columnDefinitions, undefined ];

        const [ _, ...columns ] = columnDefinitions;

        const groupingColDef: DataGridProProps['groupingColDef'] = {
            headerName: 'Product',
            sortable: true,
            flex: 3,

            renderCell: params =>
                <SalesDataGridGroupingCell href={!props.disableProductLinks && params.row.href}
                                           {...params} />,
        };

        return [ columns, groupingColDef ];

    }, [ columnDefinitions, props.disableProductLinks, requiresCategoryGrouping ]);

    // ---------------------------------------------------------------------------------------------

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

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <DataGridPro density="compact" disableColumnMenu disableColumnReorder
                         disableColumnResize hideFooter columns={columns} rows={rows}
                         slots={{ noRowsOverlay }}
                         initialState={{
                            sorting: {
                                sortModel: [
                                    {
                                        field: requiresCategoryGrouping
                                            ? GRID_TREE_DATA_GROUPING_FIELD
                                            : 'product',
                                        sort: 'asc',
                                    }
                                ]
                            }
                         }}
                         sx={{
                             '--DataGrid-overlayHeight': '120px',  // increase empty-state height
                             borderColor: 'transparent',  // remove the grid's default border
                         }}
                         treeData={requiresCategoryGrouping} groupingColDef={groupingColDef}
                         getTreeDataPath={getTreeDataPathForCategories} />
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
