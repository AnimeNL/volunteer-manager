// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { GridSlotsComponentsProps } from '@mui/x-data-grid-premium';
import { useGridRootProps } from '@mui/x-data-grid-premium';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useIsMobile } from '@app/admin/lib/useIsMobile';

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
                    <Grid size={{ xs: 12, md: 6 }}>
                        <DataTableResponsiveQuickSearch />
                    </Grid> }

                { !rootProps.hideFooterPagination &&
                    <Grid size={{ xs: 12, md: 6 }}>
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
    return (
        <Typography sx={{ flexGrow: 1 }}>
            TODO: Navigation
        </Typography>
    );
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
