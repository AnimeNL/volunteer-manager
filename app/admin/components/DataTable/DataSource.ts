// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod';

import type { GridGetRowsParams, GridGetRowsResponse, GridSortDirection }
    from '@mui/x-data-grid-premium';

import type { DataSourceProps } from './DataSourceProps';

/**
 * Types of operations that can be executed on a data source.
 */
export type DataSourceOperation = 'list';

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source. Must remain compatible with the serialisation protocol used for
 * React Server Functions, as bound instances will be passed over the wire.
 */
export interface DataSource<ZodContext, ZodRowModel> {
    /**
     * Decides whether this data source may be used by unauthenticated visitors. This is disallowed
     * by default, as the vast majority of operations are only available to signed in users.
     *
     * @default `false`
     * @returns A boolean indicating whether unauthenticated usage is allowed.
     */
    allowUnauthenticated?(): boolean;

    /**
     * Authorizes whether the user included in the `props` is allowed to execute the given
     * `operation` on this data source. Must be implemented, even when authorization is not
     * required, in order to avoid missing it by mistake.
     *
     * @param operation The operation that is about to be executed.
     * @param props Props indicating the circumstances under which this data source is used.
     * @param context When set, contextual information required by this data source.
     * @returns Nothing. Expected to call `forbidden()` when authorization has failed.
     */
    authorize(operation: DataSourceOperation,
              props: DataSourceProps,
              context: z.infer<ZodContext>): Promise<void>;

    /**
     * Retrieves the rows in accordance with the `params`.
     *
     * @param params Parameters for the list operation, including the pagination and sort models.
     * @param props Props indicating the circumstances under which this data source is used.
     * @param context When set, contextual information required by this data source.
     * @returns A response containing the paginated rows that have been requested.
     */
    list?(params: DataSourceGetRowsParams<ZodRowModel>,
          props: DataSourceProps,
          context: z.infer<ZodContext>): Promise<DataSourceGetRowsResponse<ZodRowModel>>;
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
