// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
    DataGridPremium, GRID_REORDER_COL_DEF, type GridCellParams, type GridColDef,
    type GridDataSource, type GridFilterModel, type GridPaginationModel, type GridRowModel,
    type GridRowOrderChangeParams, type GridSortModel, type GridValidRowModel }
    from '@mui/x-data-grid-premium';

import AddCircleIcon from '@mui/icons-material/AddCircle';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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
import { DataTableRowEditor } from './DataTableRowEditor';
import { ResponsiveConfirmationDialog } from '../ResponsiveConfirmationDialog';
import { isFrozenRow, isProtectedRow } from './Utilities';
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
     * Column through which it can be derived whether this row has been frozen. Frozen rows cannot
     * be edited.
     */
    frozenColumn?: keyof RowModel & string;

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
     * Whether to refresh the router when a data mutation has happened.
     */
    refreshOnMutation?: boolean;

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

    const router = useRouter();
    const subject = props.subject ?? 'item';

    const enableReorder = !!props.source.reorder;

    const loadedRowIdsRef = useRef<Array<number | string>>([]);

    // ---------------------------------------------------------------------------------------------
    // Use memoized versions of certain props that would excessively invalidate the component tree.
    // ---------------------------------------------------------------------------------------------

    const context = props.context ?? {};
    const contextString = JSON.stringify(props.context);

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

    const isMountedRef = useRef(false);
    useEffect(() => {
        isMountedRef.current = true;
    }, []);

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
        if (!isMountedRef.current)
            return;

        let newPage = model.page;

        // Adjust the |newPage| if the page size changed, to ensure that the first currently visible
        // row continues to be visible in the new view.
        if (model.pageSize !== pageSize)
            newPage = Math.floor((page * pageSize) / model.pageSize);

        if (newPage !== page)
            setPage(newPage);

        if (model.pageSize !== pageSize)
            setPageSize(model.pageSize);

    }, [ page, pageSize, setPage, setPageSize ]);

    const handleSortModelChange = useCallback((model: GridSortModel) => {
        if (!isMountedRef.current)
            return;

        const item = model[0];

        const newField = item ? item.field : null;
        const newOrder = item ? item.sort : null;

        const defaultOrder = props.defaultSort.sort;

        // In MUI Data Grid, clicking an already sorted column header cycles the sorting state
        // through unsorted -> asc -> desc -> unsorted. Unsorted is represented as "null", which
        // causes Nuqs to fall back to the default value, making the column unsortable.
        const orderToSet = model.length === 0 && defaultOrder === 'desc' ? 'asc' : newOrder;
        const nextOrder = orderToSet ?? null;
        const effectiveField = newField ?? props.defaultSort.field;
        const effectiveOrder = nextOrder ?? props.defaultSort.sort;

        if (effectiveField !== sortField || effectiveOrder !== sortOrder) {
            setSortField(newField);
            setSortOrder(nextOrder);
            setPage(null);
        }

    }, [
        props.defaultSort.field,
        props.defaultSort.sort,
        setSortField,
        setSortOrder,
        setPage,
        sortField,
        sortOrder
    ]);

    const handleFilterModelChange = useCallback((model: GridFilterModel) => {
        if (!isMountedRef.current)
            return;

        const newSearch = model.quickFilterValues?.[0] ?? '';

        if (newSearch !== search) {
            setSearch(newSearch);
            setPage(null);
        }

    }, [ setSearch, setPage, search ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to delete rows from the data table, when exposed by the source. Confirmation will be
    // obtained from the user prior to actually deleting any data.
    // ---------------------------------------------------------------------------------------------

    const [ refreshTrigger, setRefreshTrigger ] = useState<number>(0);

    const [ deleteCandidate, setDeleteCandidate ] = useState<GridRowModel | undefined>();

    const handleDeleteClose = useCallback(() => setDeleteCandidate(undefined), []);
    const handleDelete = useCallback(async () => {
        if (deleteCandidate === undefined)
            return;

        const success = await props.source.delete!(context, deleteCandidate);
        if (!success)
            throw new Error(`Unable to delete this ${subject}`);

        setRefreshTrigger(prev => prev + 1);
        setDeleteCandidate(undefined);

        if (props.refreshOnMutation)
            router.refresh();

    }, [ context, deleteCandidate, props.refreshOnMutation, props.source, router, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to create rows in the data table, when exposed by the source.
    // ---------------------------------------------------------------------------------------------

    const [ createOpen, setCreateOpen ] = useState<boolean>(false);

    const handleCreateClose = useCallback(() => setCreateOpen(false), []);
    const handleCreateSave = useCallback(async (newRow: GridRowModel) => {
        const result = await props.source.create!(context, newRow);
        if (!result)
            throw new Error(`Unable to create this ${subject}`);

        setRefreshTrigger(prev => prev + 1);
        setCreateOpen(false);

        if (props.refreshOnMutation)
            router.refresh();

    }, [ context, props.refreshOnMutation, props.source, router, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to edit rows from the data table on a mobile device, when exposed by the source.
    // ---------------------------------------------------------------------------------------------

    const [ editCandidate, setEditCandidate ] = useState<GridRowModel | undefined>();

    const handleEditClose = useCallback(() => setEditCandidate(undefined), []);
    const handleEditSave = useCallback(async (updatedRow: GridRowModel) => {
        if (editCandidate === undefined)
            return;

        const result = await props.source.update!(context, updatedRow, editCandidate);
        if (result === false)
            throw new Error(`Unable to update this ${subject}`);

        setRefreshTrigger(prev => prev + 1);
        setEditCandidate(undefined);

        if (props.refreshOnMutation)
            router.refresh();

    }, [ context, editCandidate, props.refreshOnMutation, props.source, router, subject ]);

    const isCellEditable = useCallback((params: GridCellParams) => {
        return !isFrozenRow(params.row, props.frozenColumn);
    }, [ props.frozenColumn ]);

    // ---------------------------------------------------------------------------------------------
    // Ability to reorder rows in the data table, when exposed by the source.
    // ---------------------------------------------------------------------------------------------

    const handleReorder = useCallback(async (params: GridRowOrderChangeParams) => {
        if (!props.source.reorder)
            return;

        if (params.oldIndex === params.targetIndex)
            return;

        const rowIds = [ ...loadedRowIdsRef.current ];
        if (params.oldIndex < 0 || params.oldIndex >= rowIds.length)
            return;
        if (params.targetIndex < 0 || params.targetIndex >= rowIds.length)
            return;

        const movedId = rowIds.splice(params.oldIndex, 1)[0];
        rowIds.splice(params.targetIndex, 0, movedId);

        loadedRowIdsRef.current = rowIds;

        try {
            const result = await props.source.reorder(contextRef.current, rowIds);
            if (!result)
                throw new Error(`Unable to update the row order for these ${subject}s`);

            if (props.refreshOnMutation)
                router.refresh();

        } catch (error: any) {
            setError(error.message);
            setRefreshTrigger(prev => prev + 1);
        }
    }, [ props.refreshOnMutation, props.source.reorder, router, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Compose the columns. Various common, canonical column types have templates to avoid having to
    // redefine their interface several times, which are handled here.
    // ---------------------------------------------------------------------------------------------

    const columns = useMemo(() => {
        const columns: GridColDef[] = [ /* none yet */ ];

        const renderCreateHeader = () => {
            if (!props.source.create)
                return null;

            return (
                <Tooltip title={`Create a new ${subject}`}>
                    <IconButton aria-label={`Create a new ${subject}`} size="small"
                                onClick={ () => setCreateOpen(true) }>
                        <AddCircleIcon color="success" fontSize="small" />
                    </IconButton>
                </Tooltip>
            );
        };

        if (!isMobile && enableReorder) {
            columns.push({
                ...GRID_REORDER_COL_DEF,
                renderHeader: renderCreateHeader,
            });
        }

        if (!isMobile && !!props.source.delete) {
            columns.push({
                display: 'flex',
                field: '__delete',
                headerName: '',
                sortable: false,
                width: 50,
                align: 'center',

                renderHeader: !enableReorder ? renderCreateHeader : () => null,

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
            let sortable: boolean | undefined = column.sortable;
            if (enableReorder)
                sortable = false;

            if ('template' in column && !!column.template)
                columns.push({ ...kColumnTemplates[column.template](column), sortable });
            else
                columns.push({ ...column, sortable });
        }

        return columns;

    }, [ enableReorder, props.columns, props.source.create, props.source.delete, isMobile, subject,
         props.protectedColumn ]);

    // ---------------------------------------------------------------------------------------------
    // Compose the `GridDataSource` based on the available Server Actions in the `props`.
    // ---------------------------------------------------------------------------------------------

    const sourceRef = useRef(props.source);
    sourceRef.current = props.source;

    const contextRef = useRef(context);
    contextRef.current = context;

    const dataSource = useMemo((): GridDataSource => {
        (void contextString);    // silence the Biome warning
        (void props.source.id);  // silence the Biome warning
        (void refreshTrigger);   // silence the Biome warning

        return {
            getRows: async (params) => {
                const response = await sourceRef.current.list(contextRef.current, params);

                loadedRowIdsRef.current = response.rows.map((row: any) => row.id);
                return response;
            },
            updateRow: props.source.update
                ? async (params) => {
                      const result = await sourceRef.current.update!(
                          contextRef.current, params.updatedRow, params.previousRow);

                      // TODO: Improve the error handling for failed updates.
                      if (result === false)
                          throw new Error('Failed to update the row');

                      if (props.refreshOnMutation)
                          router.refresh();

                      return typeof result === 'object' && result !== null
                          ? result
                          : params.updatedRow;
                  }
                : undefined,
        };

    }, [ contextString, props.refreshOnMutation, props.source.id, props.source.update,
         refreshTrigger, router ]);

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

                editMode={sourceRef.current.update ? 'row' : undefined}
                isCellEditable={props.frozenColumn ? isCellEditable : undefined}

                rowReordering={!isMobile && enableReorder}
                onRowOrderChange={enableReorder ? handleReorder : undefined}

                density="compact"
                pageSizeOptions={kPageSizeOptions}
                pagination
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={handlePaginationModelChange}

                sortModel={enableReorder ? undefined : sortModel}
                onSortModelChange={enableReorder ? undefined : handleSortModelChange}

                filterModel={filterModel}
                onFilterModelChange={handleFilterModelChange}

                disableColumnFilter
                disableColumnMenu
                disableColumnReorder
                disableColumnResize
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
                                onEdit={props.source.update ? setEditCandidate : undefined}
                                frozenColumn={props.frozenColumn}
                                protectedColumn={props.protectedColumn} /> :
                            <DataTableListViewRow
                                height={estimatedListViewRowHeight}
                                listViewProps={props.listViewProps} row={params.row}
                                onDelete={props.source.delete ? setDeleteCandidate : undefined}
                                onEdit={props.source.update ? setEditCandidate : undefined}
                                frozenColumn={props.frozenColumn}
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
                slotProps={{
                    footer: {
                        onCreate: props.source.create ? () => setCreateOpen(true) : undefined,
                        subject,
                    } as any,
                }}

                onDataSourceError={handleDataSourceError} />
            { isMobile && !!props.source.create && (
                <Button fullWidth variant="outlined" color="success"
                        startIcon={ <AddCircleIcon color="success" /> }
                        onClick={ () => setCreateOpen(true) }>
                    Add {subject}
                </Button> ) }
            <ResponsiveConfirmationDialog
                open={deleteCandidate !== undefined}
                onClose={handleDeleteClose}
                onConfirm={handleDelete} confirmLabel="Delete"
                title={ `Delete this ${subject}?` }>

                Are you sure that you want to remove this {props.subject}? This action can't be
                undone once you confirm its deletion

            </ResponsiveConfirmationDialog>
            <DataTableRowEditor
                open={editCandidate !== undefined}
                onClose={handleEditClose}
                onSave={handleEditSave}
                columns={props.columns}
                subject={subject}
                row={editCandidate} />
            <DataTableRowEditor
                open={createOpen}
                onClose={handleCreateClose}
                onSave={handleCreateSave}
                columns={props.columns}
                subject={subject}
                create />
        </>
    );
}
