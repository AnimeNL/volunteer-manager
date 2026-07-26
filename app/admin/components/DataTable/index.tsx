// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// TODO:
// - Client side:
//   - Functionality:
//     - Reorder rows
//   - Presentation:
//     - Tree data?

import { z } from 'zod/v4';

export * from './Column';
export * from './DataSource';
export * from './DataTable';
export * from './Transformers';
export * from './Types';

export { createDataSource } from './createDataSource';

export const withContext = z.object;
export const withRowModel = z.object;
