// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import type { GridSlotsComponentsProps } from '@mui/x-data-grid-premium';
import { Toolbar, ToolbarButton, QuickFilter, QuickFilterControl, QuickFilterClear,
    QuickFilterTrigger, useGridApiContext, useGridRootProps, useGridSelector,
    gridPaginationModelSelector, gridPaginationRowCountSelector, gridPageCountSelector }
        from '@mui/x-data-grid-premium';

import Box from '@mui/material/Box';
import CancelIcon from '@mui/icons-material/Cancel';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

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
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
            }} {...otherProps}>
                { !!quickSearch && <DataTableResponsiveQuickSearch isMobile={isMobile} /> }
                { (!quickSearch && !isMobile) && <Box /> }
                { !rootProps.hideFooterPagination &&
                    <Box>
                        { (!!isMobile && quickSearch) && <Divider sx={{ my: 1 }} /> }
                        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
                            { !isMobile && <DataTableResponsivePageSizeSelector /> }
                            { !isMobile && <Divider flexItem orientation="vertical" /> }
                            <DataTableResponsivePageNavigation isMobile={isMobile} />
                        </Stack>
                    </Box>}
            </Stack>
        </>
    );
}

/**
 * Component that allows the user to select their preferred page size for this data table. Will only
 * be displayed on desktop, as we don't consider the screen real estate to be worth it on mobile.
 */
function DataTableResponsivePageSizeSelector() {
    const apiRef = useGridApiContext();
    const rootProps = useGridRootProps();

    const paginationModel = useGridSelector(apiRef, gridPaginationModelSelector);

    const handlePageSizeChange = useCallback((event: SelectChangeEvent<number>) => {
        apiRef.current.setPageSize(event.target.value);
    }, [ apiRef ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <Select size="small" value={paginationModel.pageSize} onChange={handlePageSizeChange}>
            { rootProps.pageSizeOptions.map(inputPageSize => {
                const pageSize =
                    typeof inputPageSize === 'object' ? inputPageSize.value
                                                      : inputPageSize;

                return (
                    <MenuItem key={pageSize} value={pageSize}>
                        {pageSize}
                    </MenuItem>
                );
            } )}
        </Select>
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
            <Stack sx={{ alignItems: 'center', pr: 1 }} direction="row" spacing={2}>
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
 * State of the quick search box.
 */
type QuickSearchState = { expanded: boolean };

/**
 * Component that provides a responsive quick search experience as part of the footer. On desktop
 * it's collapsed by default but can be expanded, on mobile it's always fully visible.
 */
function DataTableResponsiveQuickSearch(props: { isMobile: boolean }) {
    return (
        <StyledToolbar sx={ props.isMobile ? {
            minHeight: 40,
            paddingTop: 2,
            paddingBottom: 1,

            '& > div': { width: '100%' },

        } : { /* empty */ }}>

            <StyledQuickFilter expanded={props.isMobile ? true : undefined}>
                { !props.isMobile &&
                    <QuickFilterTrigger render={ (triggerProps: object, state) => (
                        <Tooltip title="Search" enterDelay={0}>
                            <StyledToolbarButton {...triggerProps}
                                                 ownerState={{ expanded: state.expanded }}
                                                 color="default"
                                                 aria-disabled={state.expanded}>
                                <SearchIcon fontSize="small" />
                            </StyledToolbarButton>
                        </Tooltip>
                    )} /> }

                <QuickFilterControl render={({ ref, ...controlProps }, state) => (
                    <StyledTextField {...controlProps}
                                     ownerState={{ expanded: state.expanded }}
                                     inputRef={ref}
                                     aria-label="Search"
                                     placeholder="Search..."
                                     size="small"
                                     slotProps={{
                                         input: {
                                             startAdornment: (
                                                 <InputAdornment position="start">
                                                     <SearchIcon fontSize="small" />
                                                 </InputAdornment>
                                             ),
                                             endAdornment:
                                                 state.value ? (
                                                     <InputAdornment position="end">
                                                         <QuickFilterClear
                                                             edge="end"
                                                             size="small"
                                                             aria-label="Clear search"
                                                             material={{ sx: { mr: -0.75 } }}>

                                                             <CancelIcon fontSize="small" />
                                                         </QuickFilterClear>
                                                     </InputAdornment>) : null,

                                             ...controlProps.slotProps?.input,
                                         },
                                         ...controlProps.slotProps,
                                     }}
                                     sx={{ width: props.isMobile ? '100%' : undefined }} />
                )} />
            </StyledQuickFilter>

        </StyledToolbar>
    );
}

/**
 * Styled variant of the MUI <Toolbar> component with the border removed.
 */
const StyledToolbar = styled(Toolbar)({
    borderBottom: 0,
});

/**
 * Styled variant of the MUI <QuickFilter> component to display the search button and box.
 */
const StyledQuickFilter = styled(QuickFilter)({
    display: 'grid',
    alignItems: 'center',
    marginLeft: 'auto',
});

/**
 * Styled variant of the MUI <ToolbarButton> so that it can expand outwards into a <TextField>
 * component that takes text input, based on what the user wants to search for.
 */
const StyledToolbarButton = styled(ToolbarButton)<{ ownerState: QuickSearchState }>(
    ({ theme, ownerState }) => ({
        gridArea: '1 / 1',
        width: 'min-content',
        height: 'min-content',
        zIndex: 1,
        opacity: ownerState.expanded ? 0 : 1,
        pointerEvents: ownerState.expanded ? 'none' : 'auto',
        transition: theme.transitions.create(['opacity']),
        marginLeft: 6,
    }));

/**
 * Styled variant of the MUI <TextField> component so that it flows well into the available space,
 * up to a defined maximum width.
 */
const StyledTextField = styled(TextField)<{ ownerState: QuickSearchState; }>(
    ({ theme, ownerState }) => ({
        gridArea: '1 / 1',
        overflowX: 'clip',
        width: ownerState.expanded ? 260 : 'var(--trigger-width)',
        opacity: ownerState.expanded ? 1 : 0,
        transition: theme.transitions.create(['width', 'opacity']),
    }));
