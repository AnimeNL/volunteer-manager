// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo, useState } from 'react';

import { DataGridPremium, type GridDataSource } from '@mui/x-data-grid-premium';

import Alert from '@mui/material/Alert';

import type { Column } from './Column';
import type { DataSourceInterface } from './DataSource';

/**
 * Props available for the <DataTableClient> component.
 */
interface DataTableClientProps {
    /**
     * Columns to include in the data table. Not all may be displayed by default.
     */
    columns: Column[];

    /**
     * Server-side source through which the data table's contents will be acquired.
     */
    source: DataSourceInterface</* IsBound= */ true>;
}

/**
 * The <DataTable> component is a wrapped implementation of the MUI X <DataGrid> component with new
 * functionality to add, delete and reorder rows, backed by a series of Server Actions that decide
 * the actual functionality. This has been generalised throughout the system for consistency.
 */
export default function DataTableClient(props: DataTableClientProps) {

    // ---------------------------------------------------------------------------------------------
    // Compose the `GridDataSource` based on the available Server Actions in the `props`.
    // ---------------------------------------------------------------------------------------------

    const dataSource = useMemo((): GridDataSource => ({
        getRows: async (params) => {
            return props.source.getRows(params);
        },
    }), [ props.source ]);

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
