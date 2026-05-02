// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ZodObject } from 'zod';

import type { GridGetRowsParams, GridGetRowsResponse } from '@mui/x-data-grid-premium';

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
     * Retrieves the rows in accordance with the `params`.
     */
    getRows(params: GridGetRowsParams, context: unknown): Promise<GridGetRowsResponse>;
}
