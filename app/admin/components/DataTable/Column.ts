// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid-premium';

/**
 * Interface that defines an individual column to include in a <DataTable>.
 */
export type Column<RowModel extends GridValidRowModel = GridValidRowModel> = GridColDef<RowModel> &
{
    /**
     * The unique identifier of the column. Strictly typed based on the `RowModel`.
     */
    field: keyof RowModel;
}
