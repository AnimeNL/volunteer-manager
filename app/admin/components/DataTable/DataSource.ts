// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod';

import type { GridGetRowsParams, GridGetRowsResponse, GridSortDirection }
    from '@mui/x-data-grid-premium';

import type { DataSourceProps } from './DataSourceProps';

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source. Must remain compatible with the serialisation protocol used for
 * React Server Functions, as bound instances will be passed over the wire.
 */
export interface DataSource<ZodContext, ZodRowModel> {
    /**
     * Retrieves the rows in accordance with the `params`.
     */
    getRows(params: DataSourceGetRowsParams<ZodRowModel>,
            props: DataSourceProps,
            context: z.infer<ZodContext>)
        : Promise<DataSourceGetRowsResponse<ZodRowModel>>;
}

/**
 * Variant of `GridGetRowsParams` where the `sortModel` property is appropriately typed.
 */
interface DataSourceGetRowsParams<ZodRowModel> extends Omit<GridGetRowsParams, 'sortModel'> {
    /**
     * Collection of sort items to apply to the table's data.
     */
    sortModel: readonly {
         /**
          * The column field identifier.
          */
         field: keyof z.infer<ZodRowModel>;

         /**
          * The direction of the column that the grid should sort.
          */
         sort: GridSortDirection;
    }[];
}

/**
 * Variant of `GridGetRowsResponse` where the `rows` property is appropriately typed.
 */
interface DataSourceGetRowsResponse<ZodRowModel> extends Omit<GridGetRowsResponse, 'rows'> {
    /**
     * Rows fetched as a response of this action.
     */
    rows: z.infer<ZodRowModel>[];
}
