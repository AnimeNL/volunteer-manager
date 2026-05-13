// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid-premium';

import type { ColumnTemplate } from './ColumnTemplates';

/**
 * Interface that defines an individual column to include in a <DataTable>.
 */
export type Column<RowModel extends GridValidRowModel = GridValidRowModel> = GridColDef<RowModel> &
{
    /**
     * The unique identifier of the column. Strictly typed based on the `RowModel`.
     */
    field: keyof RowModel & string;

    /**
     * Optional predefined column templates supported by our <DataTableClient> implementation.
     * Available values include:
     *
     * * `account`          Flexible column for displaying a(n optionally linked) user account.
     * * `linkedText`       Flexible column for which the text will be linked to templateProps.href.
     * * `localDate`        Fixed-width column for a Temporal ZDT date in the local timezone.
     * * `localDateTime`    Fixed-width column for a Temporal ZDT date & time in the local timezone.
     * * `severity`         Fixed-width column for an icon-based severity indication.
     */
    template?: ColumnTemplate;

    /**
     * Props that should passed to template transformer functions.
     */
    templateProps?: Record<string, string | number>;
};
