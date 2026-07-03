// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { hash } from 'node:crypto';
import { notFound } from 'next/navigation';

import type { GridGetRowsParams, GridRowModel } from '@mui/x-data-grid-premium';

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import type { DataSource, DataSourceOperation } from './DataSource';
import type { DataSourceInterface } from './DataSourceInterface';
import type { OmitSymbols } from './Types';
import { DataSourceWrapper } from './DataSourceWrapper';

/**
 * Registry of `DataSource` instances that are known to the server, each identified by the feature-
 * supplied ID when `createDataSource` is being called and wrapped by a helper class.
 */
const kDataSourceRegistry: Map<string, DataSourceWrapper> = new Map;

/**
 * Creates a new data source from the given `dataSourceInstance`. It's stored in a registry based on
 * the given `dataSourceId` as the instance cannot be communicated back and forth with the client.
 * 
 * Multiple calls to `createDataSource` for a given `dataSourceId` will remove all previously known
 * instances. This is intentional behaviour to support HMR during development.
 *
 * @example
 * ```
 * const dataSource = createDataSource('my-data-source', withRowModel({
 *   id: z.number(),
 *   name: z.string(),
 * }), {
 *   async authorize(operation, props) {},
 *   async list(params, props, context) {
 *     return {
 *       rows: [],
 *       rowCount: 0,
 *     };
 *   }
 * });
 * ```
 *
 * @param id Unique, server-stable identifier for this data source.
 * @param context Context of the data source, which can differ per <DataTable> instance.
 * @param rowModel Row Model of the data source, as properties that exist in a Zod object.
 * @param instance Implementation of the underlying data source.
 * @return An object with bound React Server Actions that can be passed to the client.
 */
export function createDataSource<ZodRowModel extends ZodObject>(
    dataSourceId: string,
    rowModel: ZodRowModel,
    instance: DataSource<never, ZodRowModel>): DataSourceInterface<never, ZodRowModel>;
export function createDataSource<ZodContext extends ZodObject, ZodRowModel extends ZodObject>(
    dataSourceId: string,
    context: ZodContext,
    rowModel: ZodRowModel,
    instance: DataSource<ZodContext, ZodRowModel>): DataSourceInterface<ZodContext, ZodRowModel>;
export function createDataSource(...args: any) {
    const dataSourceId: string = generateHashedDataSourceId(args[0]);

    let context: ZodObject;
    let rowModel: ZodObject;
    let instance: DataSource<any, any>;

    switch (args.length) {
        case 3:
            context = z.object({ /* empty */ });
            rowModel = args[1];
            instance = args[2];
            break;

        case 4:
            context = args[1];
            rowModel = args[2];
            instance = args[3];
            break;

        default:
            throw new Error(`Invalid signature, expected 3 or 4 arguments, got ${args.length}`);
    }

    const dataSourceWrapper = new DataSourceWrapper(context, rowModel, dataSourceId, instance);
    kDataSourceRegistry.set(dataSourceId, dataSourceWrapper);

    const dataSourceInterface: OmitSymbols<DataSourceInterface<any, any>> = {
        id: dataSourceId,

        // Operations:
        create: undefined,
        delete: undefined,
        list: listProxy.bind(null, dataSourceId),
    };

    if (Object.hasOwn(instance, 'create'))
        dataSourceInterface.create = createProxy.bind(null, dataSourceId);

    if (Object.hasOwn(instance, 'delete'))
        dataSourceInterface.delete = deleteProxy.bind(null, dataSourceId);

    return dataSourceInterface;
}

/**
 * Authorizes the given |source| against the given |authenticationContext|. A copy of the source
 * will be returned, with the inaccessible operations removed.
 */
export async function authorizeDataSource<DataSourceType extends DataSourceInterface<any, any>>(
    authenticationContext: AuthenticationContext,
    source: DataSourceType,
    context: unknown): Promise<DataSourceType>
{
    const dataSourceWrapper = kDataSourceRegistry.get(source.id);
    if (!dataSourceWrapper)
        throw new Error('Attempting to authorise a non-existing data source');

    const authorizedDataSource = { ...source };
    const authorizedOperations =
        await dataSourceWrapper.batchAuthorizeOperations(authenticationContext, context);

    for (const operation of [ 'create', 'delete', 'list' ] as DataSourceOperation[]) {
        if (!authorizedOperations.has(operation))
            delete authorizedDataSource[operation];
    }

    return authorizedDataSource;
}

/**
 * Proxy Server Action towards creating a new row on the associated data source.
 */
async function createProxy(dataSourceId: string, context: unknown) {
    'use server';

    const dataSourceWrapper = kDataSourceRegistry.get(dataSourceId);
    if (!dataSourceWrapper)
        notFound();

    return dataSourceWrapper.call('create', context);
}

/**
 * Proxy Server Action towards deleting a row in the associated data source.
 */
async function deleteProxy(dataSourceId: string, context: unknown, params: GridRowModel) {
    'use server';

    const dataSourceWrapper = kDataSourceRegistry.get(dataSourceId);
    if (!dataSourceWrapper)
        notFound();

    return dataSourceWrapper.call('delete', context, params);
}

/**
 * Proxy Server Action towards listing existing rows on the associated data source.
 */
async function listProxy(dataSourceId: string, context: unknown, params: GridGetRowsParams) {
    'use server';

    const dataSourceWrapper = kDataSourceRegistry.get(dataSourceId);
    if (!dataSourceWrapper)
        notFound();

    return dataSourceWrapper.call('list', context, params);
}

/**
 * Generates a hashed data source Id based on the given `dataSourceId`, for which we consider the
 * build hash we inject during the build process. This is used to remove determinism from the IDs
 * that are shared with the client across builds, making it harder to discover other endpoints.
 *
 * @param dataSourceId The static, code-provided ID of a given data source.
 * @return A hashed representation of that ID considering both a per-build and per-instance secret.
 */
export function generateHashedDataSourceId(dataSourceId: string): string {
    const buildHash = process.env.SOURCE_COMMIT;
    const serverActionSalt = process.env.APP_SERVER_ACTION_SALT;

    return hash('sha256', dataSourceId + buildHash + serverActionSalt, 'base64url');
}
