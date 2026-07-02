// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid-premium';

import type { RowModelFields } from './Types';

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
         * * `date`             Flexible column for a Temporal ZDT date in the local timezone.
         * * `number`           Flexible column that displays a number with a variety of options.
         * * `severity`         Fixed-width column for an icon-based severity indication.
         * * `text`             Flexible column that displays text with a variety of options.
         */
        template?: never;
    } |
    {
        template: 'account';
        templateProps?: {
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
        template: 'date';
        templateProps?: {
            /**
             * Format, per the `formatDate()` formatting rules, of the text to be rendered.
             *
             * @default "YYYY-MM-DD"
             */
            format?: string;

            /**
             * When applicable, template of the URL that the cell's value should link to. May
             * contain references to other (nested) fields such as "./items/{entry.id}".
             */
            href?: string;
        };
    } |
    {
        template: 'number';
        templateProps: {
            /**
             * Limit to indicate in the column, if any. May refer to another column, or to a fixed
             * number.
             */
            limit?: RowModelFields<RowModel> | number;
        };
    } |
    {
        template: 'severity';
        templateProps?: never;
    } |
    {
        template: 'text';
        templateProps?: {
            /**
             * Default value when no value could be derived from the field. Will be displayed in a
             * grey italic text to visually distinguish it from actual values.
             *
             * @default "···"
             */
            defaultValue?: string;

            /**
             * Field that the text should be sourced from, when different from the column's field.
             */
            field?: RowModelFields<RowModel>;

            /**
             * When applicable, template of the URL that the cell's value should link to. May
             * contain references to other (nested) fields such as "./items/{entry.id}".
             */
            href?: string;

            /**
             * Prefix to display ahead of the text in a different colour. Will be part of any link.
             */
            prefix?: string;

            /**
             * Template to resolve the text against. May contain references to other (nested) fields
             * such as "{title} ({author})".
             */
            template?: string;
        };
    }
);
