// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsInteger } from 'nuqs';
import { useRouter } from 'next/navigation';

import type {
    GridCellParams, GridColDef, GridGroupingColDefOverride, GridPaginationModel,
    GridRenderCellParams, GridRowModesModel, GridRowOrderChangeParams, GridSortModel,
    GridValidRowModel } from '@mui/x-data-grid-premium';

import { DataGridPremium, GridRowModes, GRID_REORDER_COL_DEF } from '@mui/x-data-grid-premium';

import AddCircleIcon from '@mui/icons-material/AddCircle';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { type ApiEndpoints, callApi } from '@lib/callApi';

type GridSortItem = GridSortModel[number];

/**
 * Icon used to be able to drag and re-order rows. We use a smaller icon than default to fit in with
 * the dense-by-default look our data tables have.
 */
function RemoteDataTableMoveIcon() {
    return <DragIndicatorIcon fontSize="small" color="primary" sx={{ mt: 0.25 }} />
}

/**
 * Type describing a column definition in the DataTable API.
 */
export type RemoteDataTableColumn<RowModel extends GridValidRowModel> = GridColDef<RowModel> & {
    /**
     * Callback that will be invoked for each row when `enableDelete` is set, to verify whether the
     * given row, included in the `params`, is protected and thus cannot be removed.
     */
    isProtected?: (params: GridCellParams<RowModel>) => boolean;
};

/**
 * Context expected by the remote data table. Automatically inferred based on the endpoint. No
 * context must be passed when the endpoint does not expect any.
 */
type RemoteDataTableContext<Endpoint extends keyof ApiEndpoints['get']> =
    ApiEndpoints['get'][Endpoint]['request'] extends { context: unknown }
        ? { context: ApiEndpoints['get'][Endpoint]['request']['context'] }
        : { /* no context is assumed */ };

/**
 * Props accepted by the <RemoteDataTable> component.
 */
type RemoteDataTableProps<Endpoint extends keyof ApiEndpoints['get'],
                          RowModel extends GridValidRowModel> = RemoteDataTableContext<Endpoint> & {
    /**
     * Columns accepted by the data table.
     */
    columns: RemoteDataTableColumn<RowModel>[];

    /**
     * Default sort that should be applied to the table. May be overridden by the users unless the
     * column definition explicitly disallows sorting.
     */
    defaultSort: {
        /**
         * Field on which the results should be sorted.
         */
        field: keyof RowModel;

        /**
         * Direction in which the results should be sorted.
         */
        sort: 'asc' | 'desc' | null;
    };

    /**
     * Whether the table should be displayed without its regular footer, which by default contains
     * the pagination selection configurable by the user.
     */
    disableFooter?: boolean;

    /**
     * Whether new rows can be deleted. When set, this will display a _create_ icon in the header
     * of the first column. Creation will send a POST request to the server.
     */
    enableCreate?: Endpoint extends keyof ApiEndpoints['post'] ? boolean : false;

    /**
     * Whether rows can be deleted. When set, this will display a _delete_ icon as the first column
     * of every row. Deletion will only happen after the user confirms the operation.
     */
    enableDelete?: `${Endpoint}/:id` extends keyof ApiEndpoints['delete'] ? boolean : false;

    /**
     * Whether pagination state should be stored in the URL's query parameters. This helps the
     * browser's back and forward operations to navigate across pages, and offset within the table
     * as part of those navigations.
     */
    enableQueryParams?: boolean;

    /**
     * Whether rows can be reordered. An extra column will automatically be added to the table with
     * drag handles, that the user is able to freely move upwards and downwards.
     *
     * @note The ability to sort rows is incompatible with manual reordering, thus we automatically
     *       disable that when this property is set to a truthy value.
     */
    enableReorder?: `${Endpoint}/:id` extends keyof ApiEndpoints['put'] ? boolean : false;

    /**
     * Whether rows can be updated. When set, rows can be double clicked to move to edit mode, after
     * which the full row will be sent to the server using a PUT request.
     */
    enableUpdate?: `${Endpoint}/:id` extends keyof ApiEndpoints['put'] ? boolean : false;

    /**
     * The endpoint through which the remote data table can exercise operations. The following
     * interface is expected to be available:
     *
     * * DELETE /your/endpoint/:id  - Delete an individual row (when `enableDelete` is set)
     * * GET /your/endpoint         - Retrieve all rows, in a paginated format
     * * POST /your/endpoint        - Create a new row (when `enableCreate` is set)
     * * PUT /your/endpoint/:id     - Update an existing row (when `enableUpdate` is set)
     *
     * Endpoints will only be considered when the corresponding `enable{Create,Delete,Update}` flag
     * has been set on the remote data table. TypeScript will validate existence of the APIs.
     */
    endpoint: Endpoint;

    /**
     * Callback that will be invoked to determine whether a particular cell is editable.
     */
    isCellEditable?: (params: GridCellParams<RowModel, unknown>) => boolean;

    /**
     * The default number of rows that can be displayed per page. Defaults to 50.
     */
    pageSize?: 10 | 25 | 50 | 100;

    /**
     * Whether the router should be refreshed when an update has been committed.
     */
    refreshOnUpdate?: boolean;

    /**
     * Subject describing what each row in the table is representing. Defaults to "item".
     */
    subject?: string;

    /**
     * Whether the data table should be shown as a tree. When this is set to true, the `path` field
     * must be a string with the paths separated by a slash, e.g. `0/foo/bar`.
     */
    treeData?: boolean;

    /**
     * Column definition that should be used for grouping the rows in the tree view, if any.
     */
    treeDataColumn?: GridGroupingColDefOverride<RowModel>;
}

/**
 * The <RemoteDataTable> component is an implementation of the MUI-X DataGrid component that
 * displays data from a remote source, following a predefined interface. Remote sources follow a
 * consistent REST pattern and can therefore easily be set to accept full CRUD operations.
 */
export function RemoteDataTable<
    Endpoint extends keyof ApiEndpoints['get'],
    RowModel extends GridValidRowModel = GridValidRowModel>
(
    props: RemoteDataTableProps<Endpoint, RowModel>)
{
    const { enableCreate, enableDelete, enableReorder, enableUpdate, refreshOnUpdate } = props;
    const { enableQueryParams } = props;

    const subject = props.subject ?? 'item';
    const context = useMemo(() =>
        'context' in props ? { context: props.context } : { /* no context */}, [ props ]);

    const router = useRouter();

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(true);

    const [ rowCount, setRowCount ] = useState<number>(0);
    const [ rowModesModel, setRowModesModel ] = useState<GridRowModesModel>({ });
    const [ rows, setRows ] = useState<RowModel[]>([ /* no rows */]);

    const [ deleteCandidate, setDeleteCandidate ] = useState<number | undefined>();
    const [ deleteLoading, setDeleteLoading ] = useState<boolean>(false);

    // ---------------------------------------------------------------------------------------------
    // Capability: (C)reate new rows
    // ---------------------------------------------------------------------------------------------

    const handleCreate = useCallback(async () => {
        setError(undefined);
        try {
            if (!enableCreate)
                throw new Error('create actions are not supported for this type');

            const response = await callApi('post', props.endpoint as any, {
                ...context,
                row: { /* no default fields */ },
            });

            if (response.success) {
                const focusField = props.columns.length > 1 ? props.columns[1].field : undefined;

                setRowCount(rowCount => rowCount + 1 );
                setRows(rows => [ response.row, ...rows ]);

                setRowModesModel(model => ({
                    ...model,
                    [response.row.id]: {
                        fieldToFocus: focusField,
                        mode: GridRowModes.Edit,
                    }
                }));

            } else {
                setError(response.error ?? `Unable to create a new ${subject}`);
            }
        } catch (error: any) {
            setError(`Unable to create a new ${subject} (${error.message})`);
        }
    }, [ context, enableCreate, props.columns, props.endpoint, subject ]);

    const columns = useMemo(() => {
        if (!enableCreate && !enableDelete && !enableReorder)
            return props.columns;

        const columns: GridColDef<RowModel>[] = [];

        // When reordering is enabled, MUI adds a column to the table with drag handles, which needs
        // to be amended with the ability to create a new row when both features are enabled.
        // https://mui.com/x/react-data-grid/row-ordering/#customizing-the-row-reordering-icon
        if (enableReorder && enableCreate && props.columns[0]?.field !== 'id') {
            columns.push({
                ...GRID_REORDER_COL_DEF,
                renderHeader: () => {
                    return (
                        <Tooltip title={`Create a new ${subject}`}>
                            <IconButton size="small" onClick={handleCreate}>
                                <AddCircleIcon color="success" fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    );
                },
            });
        }

        for (const column of props.columns) {
            let sortable: boolean | undefined = column.sortable;
            if (enableReorder) {
                sortable = /* mutually exclusive w/ reordering */ false;
            }

            if (column.field !== 'id') {
                columns.push({ ...column, sortable });
                continue;
            }

            let align = column.align;
            let display = column.display;
            let headerAlign = column.headerAlign;

            let renderCell = column.renderCell;
            if (enableDelete) {
                align = 'center';
                display = 'flex';
                renderCell = (params: GridRenderCellParams) => {
                    if (column.isProtected && column.isProtected(params)) {
                        return (
                            <Tooltip title={`This ${subject} cannot be deleted`}>
                                <DeleteForeverIcon color="disabled" fontSize="small" />
                            </Tooltip>
                        );
                    }

                    return (
                        <Tooltip title={`Delete this ${subject}`}>
                            <IconButton onClick={ () => setDeleteCandidate(params.row.id) }
                                        size="small">
                                <DeleteForeverIcon color="error" fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    );
                };
            }

            let renderHeader = column.renderHeader;
            if (enableCreate) {
                headerAlign = 'center';
                sortable = false;
                renderHeader = () => {
                    return (
                        <Tooltip title={`Create a new ${subject}`}>
                            <IconButton size="small" onClick={handleCreate}>
                                <AddCircleIcon color="success" fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    );
                };
            }

            columns.push({
                ...column,
                align,
                display,
                headerAlign,
                renderCell,
                renderHeader,
                sortable,
            });
        }

        return columns;

    }, [ enableCreate, handleCreate, enableDelete, enableReorder, props.columns, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Capability: (R)ead existing rows
    // ---------------------------------------------------------------------------------------------

    const [ statePage, setStatePage ] = useState<number>(0);
    const [ queryPage, setQueryPage ] = useQueryState(
        'page', parseAsInteger.withDefault(0).withOptions({ history: 'push' }));

    const [ statePageSize, setStatePageSize ] = useState<number>(props.pageSize ?? 50);
    const [ queryPageSize, setQueryPageSize ] =
        useQueryState('pageSize', parseAsInteger.withDefault(props.pageSize ?? 50));

    const paginationModel = useMemo((): GridPaginationModel => {
        if (enableQueryParams) {
            return {
                page: queryPage,
                pageSize: queryPageSize,
            };
        } else {
            return {
                page: statePage,
                pageSize: statePageSize,
            };
        }

    }, [ enableQueryParams, queryPage, queryPageSize, statePage, statePageSize ]);

    const handlePaginationModelChange = useCallback((model: GridPaginationModel) => {
        if (enableQueryParams) {
            setQueryPage(model.page);
            setQueryPageSize(model.pageSize);
        } else {
            setStatePage(model.page);
            setStatePageSize(model.pageSize);
        }
    }, [ enableQueryParams, setQueryPage, setQueryPageSize ]);

    const [ sortModelDefault, setSortModelDefault ] = useState<boolean>(true);
    const [ sortModel, setSortModel ] =
        useState<GridSortModel>([ props.defaultSort as GridSortItem ]);

    const handleSortModelChange = useCallback((model: GridSortModel) => {
        if (!!model.length) {
            setSortModelDefault(false);
            setSortModel([
                {
                    field: model[0].field,
                    sort: model[0].sort ?? null,
                }
            ]);
        } else {
            if (!!sortModelDefault)
                return;  // don't double invalidate

            setSortModelDefault(true);
            setSortModel([ props.defaultSort as GridSortItem ]);
        }
    }, [ props.defaultSort, sortModelDefault ]);

    useEffect(() => {
        setError(undefined);

        // TODO: Remove `as any` when all applicable APIs have been updated to the Data Table API.
        const requestPromise = callApi('get', props.endpoint, {
            ...context,
            pagination: paginationModel,
            sort: sortModel[0],
        } as any);

        requestPromise
            .then((response: any) => {
                if (response.success) {
                    setRowCount(response.rowCount);
                    setRows(response.rows);
                } else {
                    setError(response.error ?? 'Unable to fetch the information');
                }
            })
            .catch(error => {
                setError(`Unable to fetch the information (${error.message})`)
            })
            .finally(() => setLoading(false));

    }, [ context, paginationModel, props.endpoint, sortModel ]);

    // ---------------------------------------------------------------------------------------------
    // Capability: (U)pdate existing rows
    // ---------------------------------------------------------------------------------------------

    const handleReorder = useCallback(async (params: GridRowOrderChangeParams) => {
        if (params.oldIndex === params.targetIndex)
            return;  // ignore no-op changes

        if (params.oldIndex < 0 || params.oldIndex >= rows.length)
            return;
        if (params.targetIndex < 0 || params.targetIndex >= rows.length)
            return;

        setError(undefined);
        try {
            if (!enableReorder)
                throw new Error('reorder actions are not supported for this type');

            const copiedRows = [ ...rows ];
            const copiedRow = copiedRows.splice(params.oldIndex, 1)[0];
            copiedRows.splice(params.targetIndex, 0, copiedRow);

            const response = await callApi('put', `${props.endpoint}` as any, {
                ...context,
                id: copiedRow.id,
                order: copiedRows.map(row => row.id),
            });

            if (response.success) {
                if (!!refreshOnUpdate)
                    router.refresh();

                setRows(copiedRows);
            } else {
                setError(response.error ?? 'Unable to update the row order');
            }
        } catch (error: any) {
            setError(`Unable to update the row order (${error.message})`);
        }
    }, [ context, enableReorder, props.endpoint, refreshOnUpdate, router, rows ]);

    const handleUpdate = useCallback(async (newRow: RowModel, oldRow: RowModel) => {
        setError(undefined);
        try {
            if (!enableUpdate)
                throw new Error('updates actions are not supported for this type');

            const response = await callApi('put', `${props.endpoint}/:id` as any, {
                id: newRow.id,
                ...context,
                row: newRow,
            });

            if (response.success) {
                if (!!refreshOnUpdate)
                    router.refresh();

                return newRow;
            }

            setError(response.error ?? `Unable to update a ${subject}`);
            return oldRow;

        } catch (error: any) {
            setError(`Unable to update a ${subject} (${error.message})`);
            return oldRow;
        }
    }, [ context, enableUpdate, props.endpoint, refreshOnUpdate, router, subject ]);

    // ---------------------------------------------------------------------------------------------
    // Capability: (D)elete existing rows
    // ---------------------------------------------------------------------------------------------

    const handleDelete = useCallback(async () => {
        setDeleteLoading(true);
        setError(undefined);
        try {
            if (!enableDelete)
                throw new Error('deleting actions are not supported for this type');

            if (!deleteCandidate)
                throw new Error('lost context of the delete candidate');

            const response = await callApi('delete', `${props.endpoint}/:id` as any, {
                id: deleteCandidate,
                ...context,
            });

            if (response.success) {
                if (!!refreshOnUpdate)
                    router.refresh();

                setRows(oldRows => {
                    if (!response.replacementRow)
                        return oldRows.filter(row => row.id !== deleteCandidate);

                    return oldRows.map(oldRow => {
                        if (oldRow.id !== deleteCandidate)
                            return oldRow;

                        return {
                            ...oldRow,
                            ...response.replacementRow,
                        };
                    });
                });
            } else {
                setError(response.error ?? `Unable to delete a ${subject}`);
            }
        } catch (error: any) {
            setError(`Unable to delete a ${subject} (${error.message})`);
        } finally {
            setDeleteCandidate(undefined);
            setDeleteLoading(false);
        }
    }, [ context, deleteCandidate, enableDelete, props.endpoint, refreshOnUpdate, router, subject ])

    const resetDeleteCandidate = useCallback(() => setDeleteCandidate(undefined), []);

    // ---------------------------------------------------------------------------------------------

    const getTreeDataPath = useCallback((row: RowModel) => {
        if (!Object.hasOwn(row, 'path') || typeof row.path !== 'string')
            throw new Error('Each row must have a `path` when the treeData feature is enabled');

        return row.path.split('/');
    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Collapse in={!!error} unmountOnExit>
                <Alert severity="error">
                    {error}
                </Alert>
            </Collapse>

            <DataGridPremium
                columns={columns} rows={rows} rowCount={rowCount}
                rowModesModel={rowModesModel} onRowModesModelChange={setRowModesModel}
                processRowUpdate={handleUpdate} editMode={enableUpdate ? 'row' : undefined}
                isCellEditable={props.isCellEditable}

                rowReordering={enableReorder} onRowOrderChange={handleReorder}
                slots={{ rowReorderIcon: RemoteDataTableMoveIcon }}

                pageSizeOptions={[ 10, 25, 50, 100 ]} paginationMode="server"
                paginationModel={paginationModel} pagination
                onPaginationModelChange={handlePaginationModelChange}

                sortingMode="server"
                sortModel={ enableReorder ? undefined : sortModel }
                onSortModelChange={ enableReorder ? undefined : handleSortModelChange }

                treeData={!!props.treeData} getTreeDataPath={getTreeDataPath}
                groupingColDef={props.treeDataColumn}

                initialState={{ density: 'compact' }}
                autoHeight disableColumnMenu hideFooterSelectedRowCount
                loading={loading} hideFooter={!!props.disableFooter} />

            <Dialog open={!!deleteCandidate} onClose={resetDeleteCandidate}>
                <DialogTitle>
                    Delete this {subject}?
                </DialogTitle>
                <DialogContent>
                    Are you sure that you want to remove this {subject}? This action can't be
                    undone once you confirm its deletion.
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={resetDeleteCandidate}>Cancel</Button>
                    <Button onClick={handleDelete} loading={deleteLoading} variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
