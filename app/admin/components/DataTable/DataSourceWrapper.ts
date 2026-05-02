// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { notFound } from 'next/navigation';

import type { GridGetRowsParams, GridGetRowsResponse } from '@mui/x-data-grid-premium';

import type { DataSource } from './DataSource';
import type { DataSourceProps } from './DataSourceProps';

/**
 * Types of calls that can be passed through the DataSourceWrapper.
 */
type CallType = 'getRows';

/**
 * Wrapper class around data source implementations, which provide visitor authentication, input
 * validation and call sequencing.
 */
export class DataSourceWrapper {
    #context: ZodObject | never;
    #rowModel: ZodObject;

    #dataSource: DataSource<any>;

    constructor(context: ZodObject, rowModel: ZodObject, dataSource: DataSource<any>) {
        this.#context = context;
        this.#rowModel = rowModel;

        this.#dataSource = dataSource;
    }

    /**
     * Calls into the given `action` on the data sourced wrapped by `this`. The `context` will be
     * validated, whereas the parameters will be trusted to the extent possible.
     */
    async call(action: 'getRows', context: unknown, params: GridGetRowsParams)
        : Promise<GridGetRowsResponse>;
    async call(action: CallType, context: unknown, ...args: any) {
        // TODO: Init?

        const props: DataSourceProps = { /* not implemented */ };

        const verifiedContextResult = z.safeParse(this.#context, context);
        if (!verifiedContextResult.success)
            notFound();

        const verifiedContext = verifiedContextResult.data;

        switch (action) {
            case 'getRows':
                return this.#dataSource.getRows(args[0], props, verifiedContext);
        }

        // TODO: Postfix?
    }
}
