// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod';

import type { DataSourceInterface } from './DataSourceInterface';

/**
 * Utility type to extract the Context from a DataSourceInterface.
 */
export type ExtractContext<T> = T extends DataSourceInterface<infer Context, any>
    ? Context extends never ? never : z.input<Context>
    : never;

/**
 * Utility type to extract the RowModel from a DataSourceInterface.
 */
export type ExtractRowModel<T> = T extends DataSourceInterface<any, infer RowModel>
    ? z.infer<RowModel>
    : never;

/**
 * Utility type to omit the symbol members of the given `T`.
 * @ignore
 */
export type OmitSymbols<T> = {
    [K in keyof T as K extends symbol ? never : K]: T[K];
};

/**
 * Type that expands objects within the RowModel to nested representations, e.g. "user.name".
 */
export type RowModelFields<T extends object> = {
    [K in keyof T & string]: NonNullable<T[K]> extends object
        ? K | `${K}.${RowModelFields<NonNullable<T[K]>>}`
        : K;
}[keyof T & string];
