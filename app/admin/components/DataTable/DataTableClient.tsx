// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryState, parseAsInteger } from 'nuqs';

import { DataGridPremium, type GridColDef, type GridDataSource, type GridPaginationModel,
    type GridValidRowModel } from '@mui/x-data-grid-premium';

import Alert from '@mui/material/Alert';

import type { Column } from './Column';
import type { DataSourceInterface } from './DataSourceInterface';
import type { DataTableListViewProps } from './DataTableListViewRow';
import type { ExtractContext, ExtractRowModel } from './Types';
import { DataTableListViewButtonRow, DataTableListViewRow, calculateListViewRowHeight } from './DataTableListViewRow';
import { DataTableProminentSearchToolbar } from './DataTableProminentSearchToolbar';
import { DataTableResponsiveFooter, DataTableResponsiveFooterWithQuickSearch } from './DataTableResponsiveFooter';
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

    // ---------------------------------------------------------------------------------------------
    // Use memoized versions of certain props that would excessively invalidate the component tree.
    // ---------------------------------------------------------------------------------------------

    const context = useMemo(() => props.context ?? {}, [ props.context ]);
    const estimatedListViewRowHeight =
        useMemo(() => calculateListViewRowHeight(props.listViewProps), [ props.listViewProps ]);

    // ---------------------------------------------------------------------------------------------
    // Decide on the search mode that should be active for the <DataTable>. Subtle by default.
    // ---------------------------------------------------------------------------------------------

    const search: 'disabled' | 'prominent' | 'subtle' =
        props.disableSearch ? 'disabled'
                            : props.search ?? 'subtle';

    // ---------------------------------------------------------------------------------------------
    // Control the <DataTable> state using either local state or through URL parameters, using NUQS.
    // ---------------------------------------------------------------------------------------------

    const [ statePage, setStatePage ] = useState<number>(0);
    const [ statePageSize, setStatePageSize ] = useState<number>(
        props.pageSize ?? kPageSizeDefault);

    const [ queryPage, setQueryPage ] = useQueryState(
        'page', parseAsInteger.withDefault(0).withOptions({ history: 'push' }));
    const [ queryPageSize, setQueryPageSize ] =
        useQueryState('pageSize', parseAsInteger.withDefault(props.pageSize ?? kPageSizeDefault));

    const page =
        props.disableQueryParams ? statePage
                                 : queryPage;

    const pageSize =
        props.disableQueryParams ? statePageSize
                                 : queryPageSize;

    // ---------------------------------------------------------------------------------------------

    const handlePaginationModelChange = useCallback((model: GridPaginationModel) => {
        const defaultPage = 0;
        const defaultPageSize = props.pageSize ?? kPageSizeDefault;

        let newPage = model.page;

        // Adjust the |newPage| if the page size changed, to ensure that the first currently visible
        // row continues to be visible in the new view.
        if (model.pageSize !== pageSize)
            newPage = Math.floor((page * pageSize) / model.pageSize);

        if (props.disableQueryParams) {
            setStatePage(newPage);
            setStatePageSize(model.pageSize);
        } else {
            setQueryPage(newPage === defaultPage ? null : newPage);
            setQueryPageSize(model.pageSize === defaultPageSize ? null : model.pageSize);
        }
    }, [ page, pageSize, props.pageSize, props.disableQueryParams, setQueryPage, setQueryPageSize ])

    // ---------------------------------------------------------------------------------------------
    // Compose the columns. Various common, canonical column types have templates to avoid having to
    // redefine their interface several times, which are handled here.
    //
    // TODO: Automatically generated columns (e.g. reordering, deletion)
    // TODO: Column amendments (e.g. addition)
    // ---------------------------------------------------------------------------------------------

    const columns = useMemo(() => {
        const columns: GridColDef[] = [ /* none yet */ ];
        for (const column of props.columns) {
            if ('template' in column && !!column.template)
                columns.push(kColumnTemplates[column.template](column));
            else
                columns.push(column);
        }

        return columns;

    }, [ props.columns ]);

    // ---------------------------------------------------------------------------------------------
    // Compose the `GridDataSource` based on the available Server Actions in the `props`.
    // ---------------------------------------------------------------------------------------------

    const dataSource = useMemo((): GridDataSource => ({
        getRows: async (params) => {
            return props.source.list(context, params);
        },
    }), [ context, props.source ]);

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
                columns={columns}
                dataSource={dataSource}

                density="compact"
                pageSizeOptions={kPageSizeOptions}
                pagination
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={handlePaginationModelChange}

                disableColumnFilter
                disableColumnMenu
                disableColumnReorder
                disableColumnSelector
                disableMultipleColumnsSorting
                disablePivoting
                disableRowGrouping

                hideFooter={ !!props.disableFooter }
                showToolbar={ search === 'prominent' }

                initialState={{
                    sorting: {
                        sortModel: [ props.defaultSort ],
                    }
                }}

                listView={isMobile}
                listViewColumn={{
                    field: 'id',
                    renderCell: params =>
                        props.listViewProps.linkTemplate ?
                            <DataTableListViewButtonRow
                                height={estimatedListViewRowHeight}
                                listViewProps={props.listViewProps} row={params.row} /> :
                            <DataTableListViewRow
                                height={estimatedListViewRowHeight}
                                listViewProps={props.listViewProps} row={params.row} />,
                }}

                getEstimatedRowHeight={ isMobile ? () => estimatedListViewRowHeight : undefined }
                getRowHeight={ isMobile ? () => 'auto' : params => params.densityFactor * 52 }

                slots={{
                    footer:
                        search === 'subtle'
                            ? DataTableResponsiveFooterWithQuickSearch
                            : DataTableResponsiveFooter,
                    toolbar:
                        search === 'prominent'
                            ? DataTableProminentSearchToolbar
                            : undefined,
                }}

                onDataSourceError={handleDataSourceError} />
        </>
    );
}
