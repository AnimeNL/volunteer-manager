// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod';

import type { DataSource, DataSourceInterface } from './DataSource';

/**
 * Registry of `DataSource` instances that are known to the server, each identified by the feature-
 * supplied ID when `createDataSource` is being called.
 */
const kDataSourceRegistry: Map<string, DataSourceInterface<any>> = new Map;

async function getRowsProxy(dataSourceId: string, params: any) {
    'use server';

    const dataSourceInstance = kDataSourceRegistry.get(dataSourceId);
    if (!dataSourceInstance)
        notFound();

    return dataSourceInstance.getRows(params);
}

/**
 * Definition of a Zod object, i.e. the first parameter passed to `z.object()`.
 */
type ZodObjectDefinition = Parameters<typeof z.object>[0];

/**
 * Creates a new data source from the given `dataSourceInstance`. It's stored in a registry based on
 * the given `dataSourceId` as the instance cannot be communicated back and forth with the client.
 * 
 * Multiple calls to `createDataSource` for a given `dataSourceId` will remove all previously known
 * instances. This is intentional behaviour to support HMR during development.
 *
 * @example
 * ```
 * const dataSource = createDataSource('my-data-source', {
 *   id: z.number(),
 *   name: z.string(),
 * }, {
 *   async getRows(params) {
 *     // ...
 *   }
 * });
 * ```
 *
 * @param dataSourceId Unique, server-stable identifier for this data source.
 * @param dataSourceRowModel Row Model of the data source, as properties that exist in a Zod object.
 * @param dataSourceInstance Implementation of the data source
 * @return An object with bound React Server Actions that can be passed to the client.
 */
export function createDataSource(
    dataSourceId: string,
    dataSourceRowModel: ZodObjectDefinition,
    dataSourceInstance: DataSource): DataSourceInterface</* IsBound= */ true>;
export function createDataSource(
    dataSourceId: string,
    dataSourceContext: ZodObjectDefinition,
    dataSourceRowModel: ZodObjectDefinition,
    dataSourceInstance: DataSource): DataSourceInterface</* IsBound= */ false>;
export function createDataSource(...args: any) {
    if (args.length !== 3)
        throw new Error('Support for unbound DataSource instances has not been implemented yet');

    const [ dataSourceId, dataSourceRowModel, dataSourceInstance ] = args;

    kDataSourceRegistry.set(dataSourceId, dataSourceInstance);
    return {
        getRows: getRowsProxy.bind(null, dataSourceId),
    };
}
