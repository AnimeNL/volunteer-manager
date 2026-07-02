// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod';

import type { GridGetRowsResponse } from '@mui/x-data-grid-premium';

import type { AccessOperation } from '@lib/auth/AccessDescriptor';
import type { DataSourceProps } from './DataSourceProps';

export type DataSourceOperation = 'create' | 'delete' | 'list';

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
    authorize(operation: AccessOperation,
              props: DataSourceProps,
              context: z.infer<ZodContext>): Promise<void>;

    /**
     * Creates a new row in the data source.
     *
     * @param props Props indicating the circumstances under which this data source is used.
     * @param context When set, contextual information required by this data source.
     * @returns A row model representation of the newly created row.
     */
    create?(props: DataSourceProps, context: z.infer<ZodContext>): Promise<ZodRowModel>;

    /**
     * Deletes a row in the data source.
     *
     * @param params Parameters identifying what to delete.
     * @param props Props indicating the circumstances under which this data source is used.
     * @param context When set, contextual information required by this data source.
     * @returns A boolean indicating whether the deletion succeeded.
     */
    delete?(params: z.infer<ZodRowModel>,
            props: DataSourceProps,
            context: z.infer<ZodContext>): Promise<boolean>;

    /**
     * Retrieves the rows in accordance with the `params`.
     *
     * @param params Parameters for the list operation, including the pagination and sort models.
     * @param props Props indicating the circumstances under which this data source is used.
     * @param context When set, contextual information required by this data source.
     * @returns A response containing the paginated rows that have been requested.
     */
    list?<RowModelSortField = keyof z.infer<ZodRowModel>>(
        params: DataSourceListParams<RowModelSortField>,
        props: DataSourceProps,
        context: z.infer<ZodContext>): Promise<DataSourceGetRowsResponse<ZodRowModel>>;
}

/**
 * Type that describes the parameters that will be made available to the `list()` operation of
 * a data source. Derived from the `GridGetRowsParams` type, but simplified for our needs.
 */
export interface DataSourceListParams<RowModelSortField = any> {
    /**
     * Pagination information selecting the portion of data that should be listed.
     */
    page: {
        /**
         * Offset in the data source from which data should be returned.
         */
        offset: number;

        /**
         * Maximum number of results to return from the data source.
         */
        limit: number;
    };

    /**
     * String that should be searched for in the data source, if any.
     */
    search?: string;

    /**
     * Sort field and direction that should be applied to the data.
     */
    sort: {
        /**
         * Field based on which the data should be sorted.
         */
        field: RowModelSortField;

        /**
         * Direction in which the data should be sorted.
         */
        direction: 'asc' | 'desc';
    };
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
