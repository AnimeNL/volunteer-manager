// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod';

import type { DataSourceInterface } from './DataSourceInterface';

/**
 * Utility type to extract the Context from a DataSourceInterface.
 */
export type ExtractContext<T> = T extends DataSourceInterface<infer Context, any>
    ? Context extends never ? never : z.infer<Context>
    : never;

/**
 * Utility type to extract the RowModel from a DataSourceInterface.
 */
export type ExtractRowModel<T> = T extends DataSourceInterface<any, infer RowModel>
    ? z.infer<RowModel>
    : never;
