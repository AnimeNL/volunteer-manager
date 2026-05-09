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

import { kColumnTemplates } from './ColumnTemplates';

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
     * Whether to enable the toolbar that allows
     */
    enableToolbar?: boolean;

    /**
     * The default number of rows that can be displayed per page.
     * @default 50
     */
    pageSize?: 10 | 25 | 50 | 100;

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
            ? { /* no additional props */ }
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
    // ---------------------------------------------------------------------------------------------
    // Use a memoized version of the context, which may be set to an empty object when absent.
    // ---------------------------------------------------------------------------------------------

    const context = useMemo(() => 'context' in props ? props.context : {}, [ props ]);

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

                pageSizeOptions={[ 10, 25, 50, 100 ]}
                pagination

                disableColumnFilter
                disableColumnMenu
                disableColumnReorder
                disableColumnSelector
                disableMultipleColumnsSorting
                disablePivoting
                disableRowGrouping

                showToolbar={props.enableToolbar}

                density="compact"
                initialState={{
                    pagination: {
                        paginationModel: { pageSize: props.pageSize ?? 50, page: 0 },
                    },
                    sorting: {
                        sortModel: [ props.defaultSort ],
                    }
                }}
                slotProps={{
                    toolbar: {
                        csvOptions: { disableToolbarButton: true },
                        excelOptions: { disableToolbarButton: true },
                        printOptions: { disableToolbarButton: true },
                    },
                }}

                onDataSourceError={handleDataSourceError} />
        </>
    );
}
