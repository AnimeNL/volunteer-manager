// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { notFound, unauthorized } from 'next/navigation';

import type { GridGetRowsParams, GridGetRowsResponse, GridRowModel }
    from '@mui/x-data-grid-premium';

import type { AccessOperation } from '@lib/auth/AccessDescriptor';
import type { DataSource, DataSourceListParams, DataSourceOperation } from './DataSource';
import type { DataSourceProps } from './DataSourceProps';
import { RecordErrorLog } from '@lib/Log';
import { getAuthenticationContext, type AuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Zod validator used to verify that the `GridGetRowsParams` information we get for the `list()`
 * operation adheres to the expected structure. Not meant to be comprehensive.
 */
const kGridGetRowsParamsValidator = z.object({
    // GridGetRowsParams:
    end: z.number(),
    filterModel: z.object({
        quickFilterValues: z.array(z.string()).optional(),
    }),
    sortModel: z.array(z.object({
        field: z.string(),
        sort: z.enum([ 'asc', 'desc' ]).nullish(),
    })),
    start: z.number(),
});

/**
 * Converts the given |operation| to the `AccessOperation` type.
 */
function toAccessOperation(operation: DataSourceOperation): AccessOperation {
    switch (operation) {
        case 'create':
        case 'delete':
            return operation;

        case 'list':
            return 'read';
    }
}

/**
 * Wrapper class around data source implementations, which provide visitor authentication, input
 * validation and call sequencing.
 */
export class DataSourceWrapper {
    #context: ZodObject | never;
    #rowModel: ZodObject;

    #dataSourceId: string;
    #dataSource: DataSource<any, any>;

    constructor(
        context: ZodObject,
        rowModel: ZodObject,
        dataSourceId: string,
        dataSource: DataSource<any, any>,
        )
    {
        this.#context = context;
        this.#rowModel = rowModel;

        // Data sources are predominantely expected to be used with MUI X's DataGrid, which requires
        // that an `id` field exists because those will be used as React keys for stable iteration.
        if (!Object.hasOwn(this.#rowModel.shape, 'id'))
            throw new Error('Data source row models are required to have an "id" field');

        this.#dataSourceId = dataSourceId;
        this.#dataSource = dataSource;
    }

    /**
     * Authorizes the supported operations on the data source given the |authenticationContext|, and
     * returns the set of allowed ones.
     */
    async batchAuthorizeOperations(authenticationContext: AuthenticationContext, context: unknown)
        : Promise<Set<DataSourceOperation>>
    {
        if (!authenticationContext.user && !this.#dataSource.allowUnauthenticated?.())
            return new Set();  // no operations are allowed for unauthenticated users

        const props: DataSourceProps = {
            access: authenticationContext.access,
            authenticationContext,
        };

        const verifiedContextResult = await z.safeParseAsync(this.#context, context);
        if (!verifiedContextResult.success)
            throw new Error('Invalid context passed to a data source, unable to authorize');

        const allowedOperations = new Set<DataSourceOperation>;
        for (const operation of [ 'create', 'delete', 'list' ] as DataSourceOperation[]) {
            if (!Object.hasOwn(this.#dataSource, operation))
                continue;  // operation not supported by the data source

            try {
                await this.#dataSource.authorize(
                    toAccessOperation(operation), props, verifiedContextResult.data);

                allowedOperations.add(operation);

            } catch (_error) {
                // The `authorize()` method is expected to throw an error (most commonly Next.js'
                // `forbidden()` call) when authorization is not granted. We can safely ignore that
                // situation here, as we're explicitly confirming that it does not happen.
            }
        }

        return allowedOperations;
    }

    /**
     * Calls into the given `operation` on the data sourced wrapped by `this`. Both the `context`
     * and all operation-specific parameters will be validated prior to being used.
     */
    async call(operation: 'create', context: unknown): Promise<GridRowModel>;
    async call(operation: 'delete', context: unknown, params: GridRowModel): Promise<boolean>;
    async call(operation: 'list', context: unknown, params: GridGetRowsParams)
        : Promise<GridGetRowsResponse>;
    async call(operation: DataSourceOperation, context: unknown, ...args: any) {
        const authenticationContext = await getAuthenticationContext();
        if (!authenticationContext.user && !this.#dataSource.allowUnauthenticated?.()) {
            this.reportError(
                operation, context, 'Unable to access a data source that requires authentication');

            unauthorized();  // does not return
        }

        const props: DataSourceProps = {
            access: authenticationContext.access,
            authenticationContext,
        };

        const verifiedContextResult = await z.safeParseAsync(this.#context, context);
        if (!verifiedContextResult.success) {
            this.reportError(
                operation, context, 'Unable to validate the context given by the client',
                verifiedContextResult.error);

            notFound();  // does not return
        }

        const verifiedContext = verifiedContextResult.data;

        // Require the operation to be authorized. The implementation of this method will throw an
        // exception when this fails (usually `forbidden()`), so no need to catch.
        await this.#dataSource.authorize(toAccessOperation(operation), props, verifiedContext);

        switch (operation) {
            case 'create': {
                if (!Object.hasOwn(this.#dataSource, 'create')) {
                    this.reportError(
                        operation, context, 'Data source does not support create() operations');

                    notFound();  // does not return
                }

                const createdRow = await this.#dataSource.create!(props, verifiedContext);
                const createdRowValidation = await this.#rowModel.safeParseAsync(createdRow);
                if (!createdRowValidation.success) {
                    this.reportWarning(
                        operation, context, 'Data source creates an invalid row model',
                        createdRowValidation.error);
                }

                return createdRow;
            }

            case 'delete': {
                if (!Object.hasOwn(this.#dataSource, 'delete')) {
                    this.reportError(
                        operation, context, 'Data source does not support delete() operations');

                    notFound();  // does not return
                }

                const deletingRow = args[0];
                const deletingRowValidation = await this.#rowModel.safeParseAsync(deletingRow);
                if (!deletingRowValidation.success) {
                    this.reportError(
                        operation, context, 'Unable to validate the row model given by the client',
                        deletingRowValidation.error);

                    notFound();  // does not return
                }

                return this.#dataSource.delete!(deletingRowValidation.data, props, verifiedContext);
            }

            case 'list': {
                const inputParams = kGridGetRowsParamsValidator.safeParse(args[0]);
                if (!inputParams.success) {
                    this.reportError(
                        operation, context, 'Unable to validate the params given by the client');

                    notFound();  // does not return
                }

                const validatedInputParams = inputParams.data;
                const validatedSortField = validatedInputParams.sortModel[0]?.field ?? 'id';

                if (!Object.hasOwn(this.#rowModel.shape, validatedSortField)) {
                    this.reportError(
                        operation, context, 'Unable to validate the sort key given by the client');

                    notFound();  // does not return
                }

                const params: DataSourceListParams<any> = {
                    page: {
                        offset: validatedInputParams.start,
                        limit: (validatedInputParams.end - validatedInputParams.start) + 1,
                    },
                    search: validatedInputParams.filterModel.quickFilterValues?.[0],
                    sort: {
                        field: validatedSortField,
                        direction: validatedInputParams.sortModel[0]?.sort ?? 'asc',
                    },
                };

                return this.#dataSource.list?.(params, props, verifiedContext) ?? {
                    rows: [],
                    rowCount: 0,
                };
            }
        }
    }

    /**
     * Reports an error that happened while calling through to the data source.
     *
     * @param operation Operation during which the error happened.
     * @param context Context that was given for the invocation. May not have been validated.
     * @param message Message that describes what exactly happened, in English.
     * @param error Error that optionally describes the details of what happened.
     */
    private reportError(
        operation: DataSourceOperation, context: unknown, message: string, error?: Error): void
    {
        RecordErrorLog({
            error: {
                name: 'DataSourceError',
                message,
            },
            requestUrl: {
                pathname: `/server-action/${this.#dataSourceId}`,
            },
            severity: 'Error',
            source: 'Server',

            // TODO: Store |operation|, |context| and |error| as metadata
        });
    }

    /**
     * Reports a warning that happened while calling through to the data source.
     *
     * @param operation Operation during which the error happened.
     * @param context Context that was given for the invocation. May not have been validated.
     * @param message Message that describes what exactly happened.
     * @param error Error that optionally describes the details of what happened.
     */
    private reportWarning(
        operation: DataSourceOperation, context: unknown, message: string, error?: Error): void
    {
        RecordErrorLog({
            error: {
                name: 'DataSourceError',
                message,
            },
            requestUrl: {
                pathname: `/server-action/${this.#dataSourceId}`,
            },
            severity: 'Warning',
            source: 'Server',

            // TODO: Store |operation|, |context| and |error| as metadata
        });
    }
}
