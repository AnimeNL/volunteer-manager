// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import type { GridSlotsComponentsProps } from '@mui/x-data-grid-premium';
import { useGridApiContext, useGridRootProps, useGridSelector, gridPaginationModelSelector,
    gridPaginationRowCountSelector, gridPageCountSelector } from '@mui/x-data-grid-premium';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Formatting rules to apply when formatting a quantative number.
 */
const kNumberFormat = new Intl.NumberFormat('en-GB');

/**
 * Footer used for our <DataTable> implementation. There are two main differences compared to the
 * default footer implementation provided by the MUI X DataGrid:
 *
 *   (1) Display is amended to be optimised for mobile devices, and,
 *   (2) A subtle search bar is included in the component.
 *
 * Context is derived from the MUI X DataGrid context API, no props are necessary.
 */
export function DataTableResponsiveFooterWithQuickSearch(props: GridSlotsComponentsProps['footer'])
{
    return <DataTableResponsiveFooter {...props} quickSearch />;
}

/**
 * Footer used for our <DataTable> implementation. There are two main differences compared to the
 * default footer implementation provided by the MUI X DataGrid:
 *
 *   (1) Display is amended to be optimised for mobile devices, and,
 *   (2) Optionally a subtle search bar is included in the component.
 *
 * Context is derived from the MUI X DataGrid context API, no props are necessary.
 */
export function DataTableResponsiveFooter(
    props: GridSlotsComponentsProps['footer'] & { quickSearch?: boolean })
{
    const { quickSearch, ...otherProps } = props;

    const rootProps = useGridRootProps();

    const isMobile = useIsMobile();

    return (
        <>
            <Divider />
            <Grid container sx={{ p: 1 }} {...otherProps}>
                { !!quickSearch &&
                    <Grid size={{ xs: 12, md: 5 }}>
                        <DataTableResponsiveQuickSearch />
                    </Grid> }

                { !rootProps.hideFooterPagination &&
                    <Grid size={{ xs: 12, md: 7 }}>
                        { (!!isMobile && quickSearch) && <Divider sx={{ my: 1 }} /> }
                        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
                            { !isMobile && <DataTableResponsivePageSizeSelector /> }
                            <DataTableResponsivePageNavigation isMobile={isMobile} />
                        </Stack>
                    </Grid> }
            </Grid>
        </>
    );
}

/**
 * Component that allows the user to select their preferred page size for this data table. Will only
 * be displayed on desktop, as we don't consider the screen real estate to be worth it on mobile.
 */
function DataTableResponsivePageSizeSelector() {
    return (
        <Typography>
            TODO: Rows page page?
        </Typography>
    );
}

/**
 * Component that provides responsive page navigation for the data table infrastructure. On desktop
 * this is effectively identical to the regular MUI X DataGrid display, on mobile it provides larger
 * back and forward buttons on the edges of the screen.
 *
 * @param props Whether the responsive display should be used.
 */
function DataTableResponsivePageNavigation(props: { isMobile: boolean }) {
    const apiRef = useGridApiContext();

    const paginationModel = useGridSelector(apiRef, gridPaginationModelSelector);
    const rowCount = useGridSelector(apiRef, gridPaginationRowCountSelector);
    const pageCount = useGridSelector(apiRef, gridPageCountSelector);

    // ---------------------------------------------------------------------------------------------

    const lastPage = Math.max(0, pageCount - 1);
    const computedPage = paginationModel.page <= lastPage ? paginationModel.page : lastPage;

    const start = computedPage * paginationModel.pageSize + 1;
    const end = Math.min((start + paginationModel.pageSize) - 1, rowCount);

    const handlePageChange = useCallback((page: number) => {
        apiRef.current.setPage(page);
    }, [ apiRef ]);

    // ---------------------------------------------------------------------------------------------

    const previousPageComponent = (
        <IconButton disabled={computedPage === 0}
                    onClick={ () => handlePageChange(computedPage - 1) }>
            <NavigateBeforeIcon color={computedPage === 0 ? 'disabled' : 'primary'} />
        </IconButton>
    );

    const nextPageComponent = (
        <IconButton disabled={computedPage === lastPage}
                    onClick={ () => handlePageChange(computedPage + 1) }>
            <NavigateNextIcon color={computedPage === lastPage ? 'disabled' : 'primary'} />
        </IconButton>
    );

    const pageCountComponent = (
        <Typography variant="body2">
            {kNumberFormat.formatRange(start || 0, end || 0)} of{' '}
            {kNumberFormat.format(rowCount)}
        </Typography>
    );

    if (!props.isMobile) {
        return (
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={2}>
                {pageCountComponent}
                <Box>
                    {previousPageComponent}
                    {nextPageComponent}
                </Box>
            </Stack>
        );
    } else {
        return (
            <Stack sx={{ alignItems: 'center',
                         flexGrow: 1,
                         justifyContent: "space-between" }} direction="row" spacing={2}>
                {previousPageComponent}
                {pageCountComponent}
                {nextPageComponent}
            </Stack>
        );
    }
}

/**
 * Component that provides a responsive quick search experience as part of the footer. On desktop
 * it's collapsed by default but can be expanded, on mobile it's always fully visible.
 */
function DataTableResponsiveQuickSearch() {
    return (
        <Typography>
            TODO: Quick search
        </Typography>
    );
}
