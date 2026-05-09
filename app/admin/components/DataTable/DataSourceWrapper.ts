// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { notFound } from 'next/navigation';

import type { GridGetRowsParams, GridGetRowsResponse } from '@mui/x-data-grid-premium';

import type { DataSource } from './DataSource';
import type { DataSourceProps } from './DataSourceProps';

/**
 * Types of operations that can be executed through the DataSourceWrapper.
 */
type Operation = 'list';

/**
 * Wrapper class around data source implementations, which provide visitor authentication, input
 * validation and call sequencing.
 */
export class DataSourceWrapper {
    #context: ZodObject | never;
    #rowModel: ZodObject;

    #dataSource: DataSource<any, any>;

    constructor(context: ZodObject, rowModel: ZodObject, dataSource: DataSource<any, any>) {
        this.#context = context;
        this.#rowModel = rowModel;

        this.#dataSource = dataSource;
    }

    /**
     * Calls into the given `operation` on the data sourced wrapped by `this`. The `context` will be
     * validated, whereas the parameters will be trusted to the extent possible.
     */
    async call(operation: 'list', context: unknown, params: GridGetRowsParams)
        : Promise<GridGetRowsResponse>;
    async call(operation: Operation, context: unknown, ...args: any) {
        // TODO: Init?

        const props: DataSourceProps = { /* not implemented */ };

        const verifiedContextResult = await z.safeParseAsync(this.#context, context);
        if (!verifiedContextResult.success)
            notFound();

        const verifiedContext = verifiedContextResult.data;

        switch (operation) {
            case 'list':
                return this.#dataSource.list(args[0], props, verifiedContext);
        }

        // TODO: Postfix?
    }
}
