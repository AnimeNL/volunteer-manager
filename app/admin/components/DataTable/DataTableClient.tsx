// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { DataGridPremium, type GridColDef, type GridDataSource, type GridFilterModel,
    type GridPaginationModel, type GridRowModel, type GridSortModel, type GridValidRowModel } from '@mui/x-data-grid-premium';

import Alert from '@mui/material/Alert';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import type { Column } from './Column';
import type { DataSourceInterface } from './DataSourceInterface';
import type { DataTableListViewProps } from './DataTableListViewRow';
import type { ExtractContext, ExtractRowModel } from './Types';
import { DataTableListViewButtonRow, DataTableListViewRow, calculateListViewRowHeight }
    from './DataTableListViewRow';
import { DataTableProminentSearchToolbar } from './DataTableProminentSearchToolbar';
import { DataTableResponsiveFooter, DataTableResponsiveFooterWithQuickSearch } from './DataTableResponsiveFooter';
import { DeleteConfirmation } from './DeleteConfirmation';
import { isProtectedRow } from './Utilities';
import { useDataTableState } from './useDataTableState';
import { useIsMobile } from '@app/admin/lib/useIsMobile';

import { kColumnTemplates } from './ColumnTemplates';

/**
 * Default value for the page size.
 */
const kPageSizeDefault = 50;

/**
 * Options that are available for page size selection of data tables.
 */
const kPageSizeOptions = [ 10, 25, 50, 100 ] as const;

/**
 * Props accepted by the <DataTableClient> component.
 */
interface DataTableClientCommonProps<
    Interface extends DataSourceInterface<any, any>,
    RowModel extends GridValidRowModel = ExtractRowModel<Interface>>
{
    /**
     * Columns to include in the data table. Not all may be displayed by default.
     */
    columns: Column<RowModel>[];

    /**
     * Default sort that should be applied to the table. May be overridden by the users unless the
     * column definition explicitly disallows sorting.
     */
    defaultSort: {
        /**
         * Field on which the results should be sorted.
         */
        field: keyof RowModel & string;

        /**
         * Direction in which the results should be sorted.
         */
        sort: 'asc' | 'desc' | null;
    };

    /**
     * Whether the footer should be holistically disabled. This would hide the search bar when a
     * subtle user interface has been selected.
     */
    disableFooter?: boolean;

    /**
     * Whether use of URL query parameters should be disabled for pagination state.
     */
    disableQueryParams?: boolean;

    /**
     * Whether the search functionality should be disabled. All data tables are strongly encouraged
     * to support search, regardless of whether it's a prominent or subtle user interface.
     */
    disableSearch?: boolean;

    /**
     * Props given to the default list view component that's used in the responsive mobile display.
     * All data tables must support a responsive display, with at least the primary field being set.
     */
    listViewProps: DataTableListViewProps<RowModel>;

    /**
     * The default number of rows that can be displayed per page.
     * @default 50
     */
    pageSize?: typeof kPageSizeOptions[number];

    /**
     * Column through which it can be derived whether this row has been protected. Protected rows
     * cannot be deleted.
     */
    protectedColumn?: keyof RowModel & string;

    /**
     * User interface for the search functionality. Prominent search will be an always visible
     * toolbar above the data that captures the <ctrl>+<f> keyboard shortcut. Subtle search will be
     * an icon in the footer, collapsed by default on desktop.
     *
     * @default "subtle"
     */
    search?: 'prominent' | 'subtle';

    /**
     * Server-side source through which the data table's contents will be acquired.
     */
    source: Interface;

    /**
     * Subject describing what each row in the table is representing. Used in language that needs to
     * refer to the items, such as the deletion confirmation dialog.
     *
     * @default "item"
     */
    subject?: string;
};

/**
 * Props accepted by the <DataTableClient> component, including `context` for data sources that
 * require additional context to operate.
 */
export type DataTableClientProps<
    Interface extends DataSourceInterface<any, any>,
    Context = ExtractContext<Interface>> =
    Omit<DataTableClientCommonProps<Interface> &
    (
        [Context] extends [never]
            ? {
                  /**
                   * Context necessary to bind the interface to the specific use.
                   */
                  context?: never;
              }
            : {
                  /**
                   * Context necessary to bind the interface to the specific use.
                   */
                  context: Context;
              }
    ), never>;

/**
 * The <DataTable> component is a wrapped implementation of the MUI X <DataGrid> component with new
 * functionality to add, delete and reorder rows, backed by a series of Server Actions that decide
 * the actual functionality. This has been generalised throughout the system for consistency.
 */
export default function DataTableClient<Interface extends DataSourceInterface<any, any>>(
    props: DataTableClientProps<Interface>)
{
    const isMobile = useIsMobile();

    const subject = props.subject ?? 'item';

    // ---------------------------------------------------------------------------------------------
    // Use memoized versions of certain props that would excessively invalidate the component tree.
    // ---------------------------------------------------------------------------------------------

    const context = useMemo(() => props.context ?? {}, [ props.context ]);
    const estimatedListViewRowHeight =
        useMemo(() => calculateListViewRowHeight(props.listViewProps), [ props.listViewProps ]);

    // ---------------------------------------------------------------------------------------------
    // Decide on the search mode that should be active for the <DataTable>. Subtle by default.
    // ---------------------------------------------------------------------------------------------

    const searchMode: 'disabled' | 'prominent' | 'subtle' =
        props.disableSearch ? 'disabled'
                            : props.search ?? 'subtle';

    // ---------------------------------------------------------------------------------------------
    // Control the <DataTable> state using either local state or through URL parameters.
    // ---------------------------------------------------------------------------------------------

    const {
        page, pageSize, sortField, sortOrder, search,
        setPage, setPageSize, setSortField, setSortOrder, setSearch
    } = useDataTableState({
        defaultSort: props.defaultSort,
        disableQueryParams: props.disableQueryParams,
        pageSize: props.pageSize ?? kPageSizeDefault,
    });

    // ---------------------------------------------------------------------------------------------

    const filterModel = useMemo((): GridFilterModel => ({
        items: [ /* we don't support manual filtering */ ],
        quickFilterValues: search ? [ search ] : [],
    }), [ search ]);

    const sortModel = useMemo((): GridSortModel => ([
        {
            field: sortField,
            sort: sortOrder,
        }
    ]), [ sortField, sortOrder ]);

    // ---------------------------------------------------------------------------------------------

    const handlePaginationModelChange = useCallback((model: GridPaginationModel) => {
        let newPage = model.page;

        // Adjust the |newPage| if the page size changed, to ensure that the first currently visible
        // row continues to be visible in the new view.
        if (model.pageSize !== pageSize)
            newPage = Math.floor((page * pageSize) / model.pageSize);

        setPage(newPage);
        setPageSize(model.pageSize);

    }, [ page, pageSize, setPage, setPageSize ]);

    const handleSortModelChange = useCallback((model: GridSortModel) => {
        const item = model[0];

        const newField = item ? item.field : null;
        const newOrder = item ? item.sort : null;

        const defaultOrder = props.defaultSort.sort;

        // In MUI Data Grid, clicking an already sorted column header cycles the sorting state
        // through unsorted -> asc -> desc -> unsorted. Unsorted is represented as "null", which
        // causes Nuqs to fall back to the default value, making the column unsortable.
        const orderToSet = model.length === 0 && defaultOrder === 'desc' ? 'asc' : newOrder;

        setSortField(newField);
        setSortOrder(orderToSet ?? null);
        setPage(null);

    }, [ props.defaultSort.sort, setSortField, setSortOrder, setPage ]);

    const handleFilterModelChange = useCallback((model: GridFilterModel) => {
        const newSearch = model.quickFilterValues?.[0] ?? '';

        setSearch(newSearch);
        setPage(null);

    }, [ setSearch, setPage ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to delete rows from the data table, when exposed by the source. Confirmation will be
    // obtained from the user prior to actually deleting any data.
    // ---------------------------------------------------------------------------------------------

    // xxx?
    const [ refreshTrigger, setRefreshTrigger ] = useState<number>(0);

    const [ deleteCandidate, setDeleteCandidate ] = useState<GridRowModel | undefined>();
    const [ deleteLoading, setDeleteLoading ] = useState<boolean>(false);

    const handleDeleteClose = useCallback(() => setDeleteCandidate(undefined), []);
    const handleDelete = useCallback(async () => {
        if (deleteCandidate === undefined)
            return;

        setDeleteLoading(true);
        setError(undefined);
        try {
            const success = await props.source.delete!(context, deleteCandidate);
            if (success) {
                setRefreshTrigger(prev => prev + 1);
                setDeleteCandidate(undefined);
            } else {
                setError(`Unable to delete this ${subject}`);
            }
        } catch (err: any) {
            setError(`Unable to delete this ${subject} (${err.message})`);
        } finally {
            setDeleteLoading(false);
        }
    }, [ context, deleteCandidate, props.source, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Compose the columns. Various common, canonical column types have templates to avoid having to
    // redefine their interface several times, which are handled here.
    //
    // TODO: Automatically generated column for reordering
    // TODO: Column amendments (e.g. addition)
    // ---------------------------------------------------------------------------------------------

    const columns = useMemo(() => {
        const columns: GridColDef[] = [ /* none yet */ ];

        // TODO: Add the ability to create rows to the |delete| column.
        if (!isMobile && !!props.source.delete) {
            columns.push({
                display: 'flex',
                field: '__delete',
                headerName: '',
                sortable: false,
                width: 50,
                align: 'center',

                renderCell: params => {
                    if (isProtectedRow(params.row, props.protectedColumn)) {
                        return (
                            <Tooltip title="This row cannot be deleted">
                                <DeleteForeverIcon color="disabled" fontSize="small" />
                            </Tooltip>
                        );
                    } else {
                        return (
                            <Tooltip title={`Delete this ${subject}`}>
                                <IconButton aria-label={`Delete this ${subject}`} size="small"
                                            onClick={ () => setDeleteCandidate(params.row) }>
                                    <DeleteForeverIcon color="error" fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        );
                    }
                },
            });
        }

        for (const column of props.columns) {
            if ('template' in column && !!column.template)
                columns.push(kColumnTemplates[column.template](column));
            else
                columns.push(column);
        }

        return columns;

    }, [ props.columns, props.source.delete, isMobile, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Compose the `GridDataSource` based on the available Server Actions in the `props`.
    // ---------------------------------------------------------------------------------------------

    const dataSource = useMemo((): GridDataSource => {
        (void refreshTrigger);  // silence the Biome warning
        return {
            getRows: async (params) => {
                return props.source.list(context, params);
            },
        };
    }, [ context, props.source, refreshTrigger ]);

    // ---------------------------------------------------------------------------------------------
    // Mess:

    const [ error, setError ] = useState<string | undefined>();

    const handleDataSourceError = (error: Error) => {
        setError(error.message);
    };

    return (
        <>
            { !!error &&
                <Alert severity="error">
                    {error}
                </Alert> }
            <DataGridPremium
                autoHeight
                columns={columns}
                dataSource={dataSource}
                dataSourceKeepPreviousData

                density="compact"
                pageSizeOptions={kPageSizeOptions}
                pagination
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={handlePaginationModelChange}

                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}

                filterModel={filterModel}
                onFilterModelChange={handleFilterModelChange}

                disableColumnFilter
                disableColumnMenu
                disableColumnReorder
                disableColumnSelector
                disableMultipleColumnsSorting
                disablePivoting
                disableRowGrouping

                hideFooter={ !!props.disableFooter }
                showToolbar={ searchMode === 'prominent' }

                listView={isMobile}
                listViewColumn={{
                    field: 'id',
                    renderCell: params =>
                        props.listViewProps.linkTemplate ?
                            <DataTableListViewButtonRow
                                height={estimatedListViewRowHeight}
                                listViewProps={props.listViewProps} row={params.row}
                                onDelete={props.source.delete ? setDeleteCandidate : undefined}
                                protectedColumn={props.protectedColumn} /> :
                            <DataTableListViewRow
                                height={estimatedListViewRowHeight}
                                listViewProps={props.listViewProps} row={params.row}
                                onDelete={props.source.delete ? setDeleteCandidate : undefined}
                                protectedColumn={props.protectedColumn} />,
                }}

                getEstimatedRowHeight={ isMobile ? () => estimatedListViewRowHeight : undefined }
                getRowHeight={ isMobile ? () => 'auto' : params => params.densityFactor * 52 }

                slots={{
                    footer:
                        searchMode === 'subtle'
                            ? DataTableResponsiveFooterWithQuickSearch
                            : DataTableResponsiveFooter,
                    toolbar:
                        searchMode === 'prominent'
                            ? DataTableProminentSearchToolbar
                            : undefined,
                }}

                onDataSourceError={handleDataSourceError} />
            <DeleteConfirmation
                open={deleteCandidate !== undefined}
                onClose={handleDeleteClose}
                onDelete={handleDelete}
                loading={deleteLoading}
                subject={subject} />
        </>
    );
}
