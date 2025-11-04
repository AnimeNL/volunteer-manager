// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import type { GridKeyValue, GridRenderCellParams } from '@mui/x-data-grid-pro';
import { gridFilteredDescendantCountLookupSelector, useGridApiContext, useGridRootProps,
    useGridSelector } from '@mui/x-data-grid-pro';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <SalesDataGridGroupingCell> component.
 */
interface SalesDataGridGroupingCellParams extends GridRenderCellParams {
    /**
     * Optional link that this row should forward the user to.
     */
    href?: string;
}

/**
 * The <SalesDataGridGroupingCell> component manages the cell that groups together several sales
 * products, displaying supporting data in the meantime. The following modifications have been made
 * compared to the default grouping cell:
 * 
 * 1. Ability to link through
 * 2. Different text colour for the descendant count indicator.
 * 
 * Code for MUI Data Grid's own grouping cell can be found here:
 * @see https://github.com/mui/mui-x/blob/master/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx
 */
export function SalesDataGridGroupingCell(props: SalesDataGridGroupingCellParams) {
    const { id, field, formattedValue, rowNode } = props;

    const apiRef = useGridApiContext();
    const rootProps = useGridRootProps();

    const filteredDescendantCountLookup =
        useGridSelector(apiRef, gridFilteredDescendantCountLookupSelector);
    const filteredDescendantCount = filteredDescendantCountLookup[rowNode.id] ?? 0;

    let label: GridKeyValue | null = null;
    let icon: React.ReactNode;

    if (rowNode.type === 'group') {
        label = rowNode.groupingKey;
        icon = rowNode.childrenExpanded
            ? <rootProps.slots.treeDataCollapseIcon fontSize="inherit" />
            : <rootProps.slots.treeDataExpandIcon fontSize="inherit" />;
    }

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        const childrenExpanded = rowNode.type === 'group'
            ? rowNode.childrenExpanded
            : false;

        apiRef.current.setRowChildrenExpansion(id, !childrenExpanded);
        apiRef.current.setCellFocus(id, field);
        event.stopPropagation();
    };

    return (
        <Stack direction="row" alignItems="center" sx={{ height: '100%' }}>
            <Box sx={{ width: '40px', flexShrink: 0 }}>
                { filteredDescendantCount > 0 &&
                    <rootProps.slots.baseIconButton
                        size="small"
                        onClick={handleClick}
                        tabIndex={-1}
                        {...rootProps?.slotProps?.baseIconButton}
                    >
                        {icon}
                    </rootProps.slots.baseIconButton> }
            </Box>
            <Typography variant="inherit" noWrap>

                { (!props.href || rowNode.depth > 0) && (formattedValue ?? label) }
                { (!!props.href && !rowNode.depth) &&
                    <MuiLink component={Link} href={props.href}>
                        { formattedValue ?? label }
                    </MuiLink> }

                { filteredDescendantCount > 0 &&
                    <Typography component="span" color="textSecondary" variant="inherit">
                        {' '}({filteredDescendantCount})
                    </Typography> }

            </Typography>
        </Stack>
    );
}
