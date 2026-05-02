// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ZodObject, z } from 'zod';
import { notFound } from 'next/navigation';

import type { DataSource } from './DataSource';
import type { BoundDataSourceInterface, DataSourceInterface, UnboundDataSourceInterface }
    from './DataSourceInterface';

/**
 * Registry of `DataSource` instances that are known to the server, each identified by the feature-
 * supplied ID when `createDataSource` is being called.
 */
const kDataSourceRegistry: Map<string, DataSourceInterface<any, any, any>> = new Map;

async function getRowsProxy(dataSourceId: string, params: any) {
    'use server';

    const dataSourceInstance = kDataSourceRegistry.get(dataSourceId);
    if (!dataSourceInstance)
        notFound();

    return dataSourceInstance.getRows(params);
}

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
 *   async getRows(params) {
 *     return {
 *       rows: [],
 *       rowCount: 0,
 *     };
 *   }
 * });
 * ```
 *
 * @param dataSourceId Unique, server-stable identifier for this data source.
 * @param dataSourceContext Context of the data source, which can differ per <DataTable> instance.
 * @param dataSourceRowModel Row Model of the data source, as properties that exist in a Zod object.
 * @param dataSourceInstance Implementation of the underlying data source.
 * @return An object with bound React Server Actions that can be passed to the client.
 */
export function createDataSource<ZodRowModel extends ZodObject>(
    dataSourceId: string,
    dataSourceRowModel: ZodRowModel,
    dataSourceInstance: DataSource): BoundDataSourceInterface<never, ZodRowModel>;
export function createDataSource<ZodContext extends ZodObject, ZodRowModel extends ZodObject>(
    dataSourceId: string,
    dataSourceContext: ZodContext,
    dataSourceRowModel: ZodRowModel,
    dataSourceInstance: DataSource): UnboundDataSourceInterface<ZodContext, ZodRowModel>;
export function createDataSource(...args: any) {
    const dataSourceId: string = args[0];

    let dataSourceContext: ZodObject;
    let dataSourceRowModel: ZodObject;
    let dataSourceInstance: DataSource;

    switch (args.length) {
        case 3:
            dataSourceContext = z.object({ /* empty */ });
            dataSourceRowModel = args[1];
            dataSourceInstance = args[2];
            break;

        case 4:
            dataSourceContext = args[1];
            dataSourceRowModel = args[2];
            dataSourceInstance = args[3];
            break;

        default:
            throw new Error(`Invalid signature, expected 3 or 4 arguments, got ${args.length}`);
    }

    kDataSourceRegistry.set(dataSourceId, dataSourceInstance as any);

    return {
        getRows: getRowsProxy.bind(null, dataSourceId),
    };
}
