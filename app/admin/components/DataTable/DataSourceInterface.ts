// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ZodObject } from 'zod';

import type { GridGetRowsParams, GridGetRowsResponse, GridRowModel }
    from '@mui/x-data-grid-premium';

/**
 * Unique symbol used to store metadata on the `DataSourceInterface` type for later retrieval.
 */
const context: unique symbol = Symbol('context');
const rowModel: unique symbol = Symbol('rowModel');

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source. Must remain compatible with the serialisation protocol used for
 * React Server Functions, as the interface will be passed over the wire.
 */
export interface DataSourceInterface<
    Context extends ZodObject = any,
    RowModel extends ZodObject = any>
{
    [context]: Context;
    [rowModel]: RowModel;

    /**
     * Creates a new row in the data source. Returns the row model for the newly created row, in
     * which the new ID must have been populated.
     */
    create?(context: unknown): Promise<GridRowModel>;

    /**
     * Deletes a row in the data source.
     */
    delete?(context: unknown, params: GridRowModel): Promise<boolean>;

    /**
     * Retrieves the rows in accordance with the `params`.
     */
    list(context: unknown, params: GridGetRowsParams): Promise<GridGetRowsResponse>;
}
