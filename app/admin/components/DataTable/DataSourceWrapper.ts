// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { notFound, unauthorized } from 'next/navigation';

import type { GridGetRowsParams, GridGetRowsResponse } from '@mui/x-data-grid-premium';

import type { DataSource, DataSourceOperation } from './DataSource';
import type { DataSourceProps } from './DataSourceProps';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';

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

        // Data sources are predominantely expected to be used with MUI X's DataGrid, which requires
        // that an `id` field exists because those will be used as React keys for stable iteration.
        if (!Object.hasOwn(this.#rowModel.shape, 'id'))
            throw new Error('Data source row models are required to have an "id" field');

        this.#dataSource = dataSource;
    }

    /**
     * Calls into the given `operation` on the data sourced wrapped by `this`. The `context` will be
     * validated, whereas the parameters will be trusted to the extent possible.
     */
    async call(operation: 'list', context: unknown, params: GridGetRowsParams)
        : Promise<GridGetRowsResponse>;
    async call(operation: DataSourceOperation, context: unknown, ...args: any) {
        const authenticationContext = await getAuthenticationContext();
        if (!authenticationContext.user && !this.#dataSource.allowUnauthenticated?.())
            unauthorized();

        const props: DataSourceProps = {
            access: authenticationContext.access,
            authenticationContext,
        };

        const verifiedContextResult = await z.safeParseAsync(this.#context, context);
        if (!verifiedContextResult.success)
            notFound();

        const verifiedContext = verifiedContextResult.data;

        // Require the operation to be authorized. The implementation of this method will throw an
        // exception when this fails (usually `forbidden()`), so no need to catch.
        await this.#dataSource.authorize(operation, props, verifiedContext);

        switch (operation) {
            case 'list':
                return this.#dataSource.list?.(args[0], props, verifiedContext) ?? {
                    rows: [],
                    rowCount: 0,
                };
        }
    }
}
