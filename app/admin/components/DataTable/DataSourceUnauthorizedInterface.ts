// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ZodObject, z } from 'zod';

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import type { DataSourceInterface } from './DataSourceInterface';

/**
 * Interface representing a data source that has not yet been authorized.
 */
export interface DataSourceUnauthorizedInterface<
    Context extends ZodObject = any,
    RowModel extends ZodObject = any>
{
    /**
     * Authorizes the data source using the given `authenticationContext` and optional `context`.
     */
    authorize(authenticationContext: AuthenticationContext,
              context?: z.input<Context>): DataSourceInterface<Context, RowModel>;
}
