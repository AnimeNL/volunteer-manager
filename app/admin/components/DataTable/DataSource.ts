// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod';

import type { GridGetRowsParams, GridGetRowsResponse } from '@mui/x-data-grid-premium';

/**
 * Interface that has to be provided in order for a <DataTable> component to be able to gather or
 * mutate a particular data source. Must remain compatible with the serialisation protocol used for
 * React Server Functions, as bound instances will be passed over the wire.
 */
export interface DataSource<Context> {
    /**
     * Retrieves the rows in accordance with the `params`.
     */
    getRows(params: GridGetRowsParams, context: z.infer<Context>): Promise<GridGetRowsResponse>;
}
