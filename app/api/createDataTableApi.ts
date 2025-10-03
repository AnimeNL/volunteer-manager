// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';

import { type ZodObject, type ZodTypeAny, ZodNever, z } from 'zod/v4';

import { type ActionProps, executeAction } from './Action';

/**
 * Response that is expected when an error occurred and the operation could not be fulfilled. The
 * `success` member will be set to `false`, and optionally an error may be provided.
 */
type DataTableHandlerErrorResponse = {
    /**
     * Whether the operation could be completed successfully.
     */
    success: false;

    /**
     * Error message to present to the user, when applicable.
     */
    error?: string;
};

/**
 * The context that's common across Data Table API endpoints. The `context` member will be omitted
 * when ZodNever is used instead of a more descriptive context type.
 */
type DataTableContext<Context extends ZodTypeAny> =
    Context extends ZodNever ? { /* no context */ } : z.infer<Context>;

/**
 * Request and response expected for POST requests with the purpose of creating rows.
 */
type DataTableCreateHandlerRequest<Context extends ZodTypeAny, RowModel extends ZodObject> =
    DataTableContext<Context> & {
        /**
         * Partial row containing the values that should seed the new row.
         */
        row: Partial<z.infer<RowModel>>;
    };

type DataTableCreateHandlerResponse<RowModel extends ZodObject> = DataTableHandlerErrorResponse |
    {
        /**
         * Whether the operation could be completed successfully.
         */
        success: true;

        /**
         * The row that was created. Follows the `RowModel`, but requires an ID to be set.
         */
        row: z.infer<RowModel> & { id: number };
    };

/**
 * Request and response expected for DELETE requests with the purpose of deleting rows.
 */
type DataTableDeleteHandlerRequest<Context extends ZodTypeAny> = DataTableContext<Context> & {
    /**
     * Unique ID of the row that's about to be deleted.
     */
    id: number;
};

type DataTableDeleteHandlerResponse<RowModel extends ZodObject> =
    DataTableHandlerErrorResponse | {
        /**
         * Whether the operation could be completed successfully.
         */
        success: true,

        /**
         * The row that the existing entry should be replaced with, if any. This may be a partial
         * response, all other fields will be maintained when it is.
         */
        replacementRow?: Partial<z.infer<RowModel>>;
    };

/**
 * Request and response expected for GET requests with the purpose of retrieving a single row.
 */
type DataTableGetHandlerRequest<Context extends ZodTypeAny> = DataTableContext<Context> & {
    /**
     * Unique ID of the row that's about to be deleted.
     */
    id: number;
};

type DataTableGetHandlerResponse<RowModel extends ZodObject> = DataTableHandlerErrorResponse | {
    /**
     * Whether the operation could be completed successfully.
     */
    success: true;

    /**
     * The row that was retrieved.
     */
    row: z.infer<RowModel>;
};

/**
 * Request and response expected for GET requests with the purpose of listing rows.
 */
type DataTableListHandlerRequest<RowModel extends ZodObject,
                                 Context extends ZodTypeAny> = DataTableContext<Context> & {
    /**
     * Pagination that should be applied to the row selection.
     */
    pagination?: {
        /**
         * Current page number to display. Zero-based, i.e. the first page is page 0.
         */
        page: number;

        /**
         * The number of rows that should be displayed per table.
         */
        pageSize: number;
    };

    /**
     * Sort that should be applied to the data. Must be complete when included.
     */
    sort?: {
        /**
         * Field on which the results should be sorted. These must be included in the `RowModel`.
         */
        field: keyof z.infer<RowModel>;

        /**
         * Direction in which the results should be sorted.
         */
        sort: 'asc' | 'desc' | null;
    };
};

type DataTableListHandlerResponse<RowModel extends ZodObject> = DataTableHandlerErrorResponse | {
    /**
     * Whether the operation could be completed successfully.
     */
    success: true,

    /**
     * The total number of rows that are available in the database.
     */
    rowCount: number;

    /**
     * The rows to display in the current Data Table view, considering pagination.
     */
    rows: z.infer<RowModel>[];
};

/**
 * Request and response expected for PUT requests with the purpose of reordering rows.
 */
type DataTableReorderHandlerRequest<Context extends ZodTypeAny> = DataTableContext<Context> & {
    /**
     * Unique ID of the row that's been moved.
     */
    id: number;

    /**
     * The order in which the rows should be sorted. Inclusive of all IDs that were known on the
     * client.
     */
    order: number[];
};

type DataTableReorderHandlerResponse = DataTableHandlerErrorResponse | {
    /**
     * Whether the operation could be completed successfully.
     */
    success: true,
};

/**
 * Request and response expected for PUT requests with the purpose of updating rows.
 */
type DataTableUpdateHandlerRequest<RowModel extends ZodObject,
                                   Context extends ZodTypeAny> = DataTableContext<Context> & {
    /**
     * Unique ID of the row that's about to be updated. Also contained within the `row`, whereas it
     * has been verified that the values are identical.
     */
    id: number;

    /**
     * The row that should be updated.
     */
    row: z.infer<RowModel> & { id: number; };
};

type DataTableUpdateHandlerResponse = DataTableHandlerErrorResponse | {
    /**
     * Whether the operation could be completed successfully.
     */
    success: true,
};

/**
 * The input request format for PUT requests to this Data Table API's endpoint. The endpoint
 * supports two formats - either updating a single row, or updating row order.
 */
type DataTablePutHandlerRequest<RowModel extends ZodObject, Context extends ZodTypeAny> =
    DataTableReorderHandlerRequest<Context> | DataTableUpdateHandlerRequest<RowModel, Context>;

/**
 * Request context that can be shared with the `writeLog` function.
 */
type DataTableWriteLogRequest<Context extends ZodTypeAny> = DataTableContext<Context> & {
    /**
     * Unique ID of the created or mutated row.
     */
    id: number;
};

/**
 * `callApi()` compatible endpoint definitions for the generated APIs.
 */
export type DataTableEndpoints<RowModel extends ZodObject, Context extends ZodTypeAny> = {
    create: {
        request: DataTableCreateHandlerRequest<Context, RowModel>,
        response: DataTableCreateHandlerResponse<RowModel>,
    },
    delete: {
        request: DataTableDeleteHandlerRequest<Context>,
        response: DataTableDeleteHandlerResponse<RowModel>,
    },
    get: {
        request: DataTableGetHandlerRequest<Context>,
        response: DataTableGetHandlerResponse<RowModel>,
    },
    list: {
        request: DataTableListHandlerRequest<RowModel, Context>,
        response: DataTableListHandlerResponse<RowModel>,
    },
    update: {
        request: DataTablePutHandlerRequest<RowModel, Context>,
        response: DataTableUpdateHandlerResponse,
    },
};

/**
 * Abstract interface describing the Data Table API that has to be implemented by each customer.
 */
export interface DataTableApi<RowModel extends ZodObject, Context extends ZodTypeAny> {
    /**
     * Execute an access check for the given `action`. The `props` and `context` may be consulted
     * if necessary. This call will be _awaited_ for, and can also return synchronously.
     */
    accessCheck?(request: DataTableContext<Context>,
                 action: 'create' | 'delete' | 'get' | 'list' | 'reorder' | 'update',
                 props: ActionProps)
        : Promise<void> | void;

    /**
     * Creates a new row in the database, and returns the `RowModel` for the new row. An ID must
     * be included as it's expected by the `<RemoteDataTable>` interface.
     */
    create?(request: DataTableCreateHandlerRequest<Context, RowModel>, props: ActionProps)
        : Promise<DataTableCreateHandlerResponse<RowModel>>;

    /**
     * Deletes the row included in the `request`. Delete actions return no data other than a success
     * flag, and optionally a message when an error occurs.
     */
    delete?(request: DataTableDeleteHandlerRequest<Context>, props: ActionProps)
        : Promise<DataTableDeleteHandlerResponse<RowModel>>;

    /**
     * Retrieves a single row from the data source, as opposed to listing all of the rows. The
     * `request` includes the necessasry parameter (`id`) to share the requested unique ID.
     */
    get?(request: DataTableGetHandlerRequest<Context>, props: ActionProps)
        : Promise<DataTableGetHandlerResponse<RowModel>>;

    /**
     * Implements the ability to retrieve the rows that should be displayed in the data table. The
     * `request` includes the necessary parameters to support pagination and sorting.
     */
    list?(request: DataTableListHandlerRequest<RowModel, Context>, props: ActionProps)
        : Promise<DataTableListHandlerResponse<RowModel>>;

    /**
     * Reorders the rows in the data table in accordance with the `request`, which contains all
     * rows that were fetched. This functionality does not work well with pagination.
     */
    reorder?(request: DataTableReorderHandlerRequest<Context>, props: ActionProps)
        : Promise<DataTableReorderHandlerResponse>;

    /**
     * Updates a given row in the database. The full to-be-updated row must be given, including the
     * fields that are not editable. The row ID is mandatory in this request.
     */
    update?(request: DataTableUpdateHandlerRequest<RowModel, Context>, props: ActionProps)
        : Promise<DataTableUpdateHandlerResponse>;

    /**
     * Called when a mutation has occurred in case the implementation wants to log the fact that
     * this action has taken place. This call will be _awaited_ for.
     */
    writeLog?(request: DataTableWriteLogRequest<Context>,
              mutation: 'Created' | 'Deleted' | 'Reordered' | 'Updated', props: ActionProps)
        : Promise<void> | void;
}

/**
 * Parameters that are passed by Next.js to route handlers.
 */
type DataTableApiHandlerParams = { params: Promise<{ [key: string]: string | string[] }> };

/**
 * Signature of an individual route handler provided by this mechanism.
 */
type DataTableApiHandler =
    (request: NextRequest, params: DataTableApiHandlerParams) => Promise<Response>;

/**
 * Signature returned by the `createDataTableApi()` function, which provides generated functions
 * that can be exported from the route handler of one of these APIs.
 */
type DataTableApiHandlers = {
    DELETE: (request: NextRequest, params: DataTableApiHandlerParams) => Promise<Response>;
    GET: (request: NextRequest, params: DataTableApiHandlerParams) => Promise<Response>;
    POST: (request: NextRequest, params: DataTableApiHandlerParams) => Promise<Response>;
    PUT: (request: NextRequest, params: DataTableApiHandlerParams) => Promise<Response>;
}

/**
 * Retrieves a strongly typed array of the keys included in the given `obj`.
 * @see https://github.com/colinhacks/zod/discussions/839
 */
function getTypedObjectKeys<K extends string>(obj: Record<K, any>): K[] {
    return Object.keys(obj) as K[];
}

/**
 * Creates the routing implementation for a DataTable API handler. Creates the route handlers as are
 * needed for the `DELETE`, `GET`, `POST` and `PUT` request methods.
 *
 * @param rowModel Zod definition of an individual row this API will deal with.
 * @param context Zod definition of the context used by the implementation. Use `z.never()` to omit.
 * @param implementation Implementation of the Data Table API specific to this type.
 */
export function createDataTableApi<RowModel extends ZodObject, Context extends ZodTypeAny>(
    rowModel: RowModel,
    context: Context,
    implementation: DataTableApi<RowModel, Context>): DataTableApiHandlers
{
    let zContext = context;
    if (zContext instanceof ZodNever) {
        // TypeScript thinks that the `instanceof` conditionals are truthy and thus ends up with an
        // incorrect definition for `zContext`. Using just `context` plainly does not work as the
        // NEVER type cannot be combined with an object. It works fine in practice.
        // @ts-ignore
        zContext = z.object({});
    }

    const zErrorResponse = z.object({
        success: z.literal(false),
        error: z.string().optional(),
    });

    // ---------------------------------------------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------------------------------------------

    const deleteInterface = z.object({
        request: zContext.and(z.object({
            id: z.coerce.number(),
        })),
        response: z.discriminatedUnion('success', [
            zErrorResponse,
            z.object({
                success: z.literal(true),
                replacementRow: rowModel.partial().optional(),
            }),
        ]),
    });

    const DELETE: DataTableApiHandler = async(request, { params }) => {
        return executeAction(request, deleteInterface, async (innerRequest: any, props) => {
            if (!implementation.delete)
                throw new Error('Cannot handle DELETE requests without a delete handler');

            await implementation.accessCheck?.(innerRequest, 'delete', props);

            const response = await implementation.delete(innerRequest, props);
            if (response.success)
                await implementation.writeLog?.(innerRequest, 'Deleted', props);

            return response;
        }, await params);
    };

    // ---------------------------------------------------------------------------------------------
    // GET
    // ---------------------------------------------------------------------------------------------

    const getInterface = z.object({
        request: z.union([
            // get:
            zContext.and(z.object({
                id: z.coerce.number(),
            })),

            // list:
            zContext.and(z.object({
                pagination: z.object({
                    page: z.coerce.number(),
                    pageSize: z.enum([ '10', '25', '50', '100' ]).transform(v => parseInt(v, 10)),
                }).optional(),
                sort: z.object({
                    field: z.enum([
                        getTypedObjectKeys(rowModel.shape)[0],
                        ...getTypedObjectKeys(rowModel.shape)
                    ]),
                    sort: z.enum([ 'asc', 'desc' ]).nullable(),
                }).optional(),
            })),
        ]),
        response: z.union([
            zErrorResponse,

            // get:
            z.object({
                success: z.literal(true),
                row: rowModel,
            }),

            // list:
            z.object({
                success: z.literal(true),
                rowCount: z.number(),
                rows: z.array(rowModel),
            }),
        ]),
    });

    const GET: DataTableApiHandler = async(request, { params }) => {
        return executeAction(request, getInterface, async (innerRequest: any, props) => {
            if ('id' in innerRequest) {
                if (!implementation.get)
                    throw new Error('Cannot handle GET(:id) requests without a get handler');

                await implementation.accessCheck?.(innerRequest, 'get', props);
                return implementation.get(innerRequest, props);
            } else {
                if (!implementation.list)
                    throw new Error('Cannot handle GET requests without a list handler');

                await implementation.accessCheck?.(innerRequest, 'list', props);
                return implementation.list(innerRequest as any, props) as any;
            }
        }, await params);
    };

    // ---------------------------------------------------------------------------------------------
    // POST
    // ---------------------------------------------------------------------------------------------

    const postInterface = z.object({
        request: zContext.and(z.object({
            row: rowModel.partial(),
        })),
        response: z.discriminatedUnion('success', [
            zErrorResponse,
            z.object({
                success: z.literal(true),
                row: rowModel.and(z.object({ id: z.number() }))
            }),
        ]),
    });

    const POST: DataTableApiHandler = async(request, { params }) => {
        return executeAction(request, postInterface, async (innerRequest: any, props) => {
            if (!implementation.create)
                throw new Error('Cannot handle POST requests without a create handler');

            await implementation.accessCheck?.(innerRequest, 'create', props);

            const response = await implementation.create(innerRequest, props);
            if (response.success) {
                await implementation.writeLog?.(
                    { ...innerRequest, id: response.row.id }, 'Created', props);
            }

            return response;
        }, await params);
    };

    // ---------------------------------------------------------------------------------------------
    // PUT
    // ---------------------------------------------------------------------------------------------

    const putInterface = z.object({
        request: zContext.and(z.object({
            id: z.coerce.number(),
        })).and(
            z.object({
                row: rowModel.and(z.object({ id: z.number() })),
            }).or(z.object({
                order: z.array(z.number()),
            }))
        ),
        response: z.discriminatedUnion('success', [
            zErrorResponse,
            z.object({
                success: z.literal(true),
            }),
        ]),
    });

    const PUT: DataTableApiHandler = async(request, { params }) => {
        return executeAction(request, putInterface, async (innerRequest: any, props) => {
            if ('order' in innerRequest) {
                if (!implementation.reorder)
                    throw new Error('Cannot handle PUT requests without an reorder handler');

                if (innerRequest.order.length < 2)
                    throw new Error('Expected at least two rows when reordering rows.');

                await implementation.accessCheck?.(innerRequest, 'reorder', props);

                const response = await implementation.reorder(innerRequest, props);
                if (response.success)
                    await implementation.writeLog?.(innerRequest, 'Reordered', props);

                return response;

            } else {
                if (!implementation.update)
                    throw new Error('Cannot handle PUT requests without an update handler');

                if (innerRequest.id !== innerRequest.row.id)
                    throw new Error('ID mismatch between the route and the contained row');

                await implementation.accessCheck?.(innerRequest, 'update', props);

                const response = await implementation.update(innerRequest, props);
                if (response.success)
                    await implementation.writeLog?.(innerRequest, 'Updated', props);

                return response;
            }

        }, await params);
    };

    return { DELETE, GET, POST, PUT };
}
