// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GridGetRowsParams, GridGetRowsResponse } from '@mui/x-data-grid-premium';

/**
 * Unique symbol used to indicate whether a `DataSourceInterface` type has been bound to context.
 */
const bound: unique symbol = Symbol('bound');

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source. Must remain compatible with the serialisation protocol used for
 * React Server Functions, as bound instances will be passed over the wire.
 *
 * @private Exclusively for internal use in the DataTable library.
 */
export interface DataSourceInterface<IsBound extends boolean> {
    [bound]: IsBound;

    /**
     * Retrieves the rows in accordance with the `params`.
     */
    getRows(params: GridGetRowsParams): Promise<GridGetRowsResponse>;
}

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source, which is ready to be used by a table.
 */
export type BoundDataSourceInterface = DataSourceInterface</* IsBound= */ true>;

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source, which must be bound to a context prior to being used.
 */
export type UnboundDataSourceInterface = DataSourceInterface</* IsBound= */ false>;
