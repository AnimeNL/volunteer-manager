// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { z } from 'zod';
import { useMemo, useState } from 'react';

import { DataGridPremium, type GridDataSource } from '@mui/x-data-grid-premium';

import Alert from '@mui/material/Alert';

import type { Column } from './Column';
import type { DataSourceInterface } from './DataSourceInterface';
import type { ExtractRowModel } from './Types';

/**
 * Props accepted by the <DataTableClient> component.
 */
interface DataTableClientCommonProps<Interface extends DataSourceInterface<any, any>> {
    /**
     * Columns to include in the data table. Not all may be displayed by default.
     */
    columns: Column<ExtractRowModel<Interface>>[];

    /**
     * Server-side source through which the data table's contents will be acquired.
     */
    source: Interface;
};

/**
 * Props accepted by the <DataTableClient> component, including `context` for data sources that
 * require additional context to operate.
 */
export type DataTableClientProps<Interface extends DataSourceInterface<any, any>> =
    DataTableClientCommonProps<Interface> &
    (
        Interface extends DataSourceInterface<infer Context, any>
            ? [Context] extends [never]
                ? { /* no additional props */ }
                : {
                      /**
                       * Context necessary to bind the interface to the specific use.
                       */
                      context: z.infer<Context>
                  }
            : { /* no additional props */ }
    );

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
    // Compose the `GridDataSource` based on the available Server Actions in the `props`.
    // ---------------------------------------------------------------------------------------------

    const dataSource = useMemo((): GridDataSource => ({
        getRows: async (params) => {
            return props.source.getRows(context, params);
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
                columns={props.columns}
                dataSource={dataSource}
                onDataSourceError={handleDataSourceError} />
        </>
    );
}
