// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// TODO:
// - Client side:
//   - Default sort
//   - Functionality:
//     - Create rows
//     - Delete rows (w/ refresh on update?)
//     - Reorder rows
//     - Update rows (w/ refresh on update?)
//   - Presentation:
//     - Responsive display by default
//       - Ability to delete rows
//       - Ability to update rows through a dialog
//     - Tree data?
// - Server side:
//   - Bound (w/ context) and unbound data sources
//   - Logging (for mutations)
//   - Permission checks
//   - Zod validation

import { z } from 'zod';

export * from './Column';
export * from './DataSource';
export * from './DataTable';

export { createDataSource } from './createDataSource';

export const withContext = z.object;
export const withRowModel = z.object;
