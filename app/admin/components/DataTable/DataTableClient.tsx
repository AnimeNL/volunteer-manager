// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo, useState } from 'react';

import { DataGridPremium, type GridColDef, type GridDataSource, type GridValidRowModel }
    from '@mui/x-data-grid-premium';

import Alert from '@mui/material/Alert';

import type { Column } from './Column';
import type { DataSourceInterface } from './DataSourceInterface';
import type { ExtractContext, ExtractRowModel } from './Types';
import { DataTableListViewButtonRow, DataTableListViewRow, calculateListViewRowHeight } from './DataTableListViewRow';
import { DataTableProminentSearchToolbar } from './DataTableProminentSearchToolbar';
import { DataTableResponsiveFooter, DataTableResponsiveFooterWithQuickSearch } from './DataTableResponsiveFooter';
import { useIsMobile } from '@app/admin/lib/useIsMobile';

import { kColumnTemplates } from './ColumnTemplates';

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
     * Whether the search functionality should be disabled. All data tables are strongly encouraged
     * to support search, regardless of whether it's a prominent or subtle user interface.
     */
    disableSearch?: boolean;

    /**
     * Props given to the default list view component that's used in the responsive mobile display.
     * All data tables must support a responsive display, with at least the primary field being set.
     */
    listViewProps: {
        /**
         * Primary text on the list item. Will be displayed in bold and is guaranteed to not wrap.
         */
        primaryField: keyof RowModel & string;

        /**
         * Secondary text on the list item. Guaranteed to not wrap.
         */
        secondaryField?: keyof RowModel & string;

        /**
         * Date to display on the right-hand side of the list item.
         */
        dateField?: keyof RowModel & string;

        /**
         * Format to display the `dateField` in. Must adhere to the formatting rules that are
         * supported by the `formatDate()` method.
         *
         * @default "YYYY-MM-DD"
         */
        dateFieldFormat?: string;

        /**
         * Template from which the URL to link to can be derived. Can contain any of the fields as
         * a curly brace-contained string, for example: "/program/event/{id}". Nested references are
         * allowed as well, for example: "/accounts/{user.id}".
         */
        linkTemplate?: string;
    };

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
                    pagination: {
                        paginationModel: { pageSize: props.pageSize ?? 50, page: 0 },
                    },
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
