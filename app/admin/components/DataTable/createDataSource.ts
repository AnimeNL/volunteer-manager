// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { notFound } from 'next/navigation';

import type { GridGetRowsParams } from '@mui/x-data-grid-premium';

import type { DataSource } from './DataSource';
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
    const dataSourceId: string = args[0];

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

    const dataSourceWrapper = new DataSourceWrapper(context, rowModel, instance);
    kDataSourceRegistry.set(dataSourceId, dataSourceWrapper);

    const dataSourceInterface: OmitSymbols<DataSourceInterface<any, any>> = {
        list: listProxy.bind(null, dataSourceId),
    };

    if (Object.hasOwn(instance, 'create'))
        dataSourceInterface.create = createProxy.bind(null, dataSourceId);

    return dataSourceInterface;
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
 * Proxy Server Action towards listing existing rows on the associated data source.
 */
async function listProxy(dataSourceId: string, context: unknown, params: GridGetRowsParams) {
    'use server';

    const dataSourceWrapper = kDataSourceRegistry.get(dataSourceId);
    if (!dataSourceWrapper)
        notFound();

    return dataSourceWrapper.call('list', context, params);
}
