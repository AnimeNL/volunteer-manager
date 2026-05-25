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
    field: keyof RowModel & string;
} & (
    {
        /**
         * Optional predefined column templates supported by our <DataTableClient> implementation.
         * Available values include:
         *
         * * `account`          Flexible column for displaying a(n optionally linked) user account.
         * * `component`        Flexible column for which a the templateProps.component will be shown.
         * * `linkedText`       Flexible column for which the text will be linked to templateProps.href.
         * * `localDate`        Fixed-width column for a Temporal ZDT date in the local timezone.
         * * `localDateTime`    Fixed-width column for a Temporal ZDT date & time in the local timezone.
         * * `otherFieldText`   Flexible column that will display the text for another field.
         * * `severity`         Fixed-width column for an icon-based severity indication.
         */
        template?: never;
    } |
    {
        template: 'account';
        templateProps: {
            noAccountLabel?: string;
        };
    } |
    {
        template: 'component';
        templateProps: {
            headerComponent?: React.JSXElementConstructor<{ /* no props */ }>;
            componentContext?: any;
            component: React.JSXElementConstructor<{ row: RowModel, context?: any }>;
        };
    } |
    {
        template: 'linkedText';
        templateProps: {
            href?: string;
        };
    } |
    {
        template: 'localDate';
        templateProps?: never;
    } |
    {
        template: 'localDateTime';
        templateProps?: never;
    } |
    {
        template: 'otherFieldText';
        templateProps: {
            field: keyof RowModel;
        };
    } |
    {
        template: 'severity';
        templateProps?: never;
    }
);
