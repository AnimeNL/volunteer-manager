// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import dynamic from 'next/dynamic';

import type { BoundDataSourceInterface } from './DataSourceInterface';
import type { Column } from './Column';

const DataTableClient = dynamic(() => import('./DataTableClient'), { ssr: false });

/**
 * Props available for the <DataTable> component.
 */
interface DataTableProps {
    /**
     * Columns to include in the data table. Not all may be displayed by default.
     */
    columns: Column[];

    /**
     * Server-side source through which the data table's contents will be acquired.
     */
    source: BoundDataSourceInterface;
}

/**
 * The <DataTable> component is a wrapped implementation of the MUI X `<DataGrid>` component with
 * additional functionality to create, delete and mutate existing rows. In minimal usage, its given
 * a collection of `columns` to display, and a `source` to obtain information from. The ability to
 * mutate data is decided based on the capabilities exposed by the `source`.
 *
 * The <DataTableClient> component contains the primary logic for the client-side display, whereas
 * the `createDataSource` and `bindDataSource` functions are helpful in establishing a data source.
 *
 * This component exists to stop Next.js applying SSR to the data table, which leads to a series of
 * hydration errors for incorrect reasons. Rather, we load it lazily.
 */
export function DataTable(props: DataTableProps) {
    return (
        <DataTableClient columns={props.columns}
                         source={props.source} />
    );
}
