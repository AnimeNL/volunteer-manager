// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import type { GridRowModel } from '@mui/x-data-grid-premium';

import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { LocalDateTime } from '../LocalDateTime';
import { resolveTemplatedUrl } from './Utilities';

/**
 * Props used to compose the list view presentation of a <DataTable> row.
 */
export interface DataTableListViewProps<RowModel extends { /* object */ }> {
    /**
     * Primary text on the list item. Will be displayed in bold and is guaranteed to not wrap.
     */
    primaryField: keyof RowModel & string;

    /**
     * Secondary text on the list item. Guaranteed to not wrap.
     */
    secondaryField?: keyof RowModel & string;

    /**
     * Date to display on the right-hand side of the list item.
     */
    dateField?: keyof RowModel & string;

    /**
     * Format to display the `dateField` in. Must adhere to the formatting rules that are
     * supported by the `formatDate()` method.
     *
     * @default "YYYY-MM-DD"
     */
    dateFieldFormat?: string;

    /**
     * Component to display at the start of the list item, if any.
     */
    startComponent?: React.JSXElementConstructor<{ row: RowModel, listView?: boolean }>;

    /**
     * Component to display at the end of the list item, if any.
     */
    endComponent?: React.JSXElementConstructor<{ row: RowModel, listView?: boolean }>;

    /**
     * Template from which the URL to link to can be derived. Can contain any of the fields as
     * a curly brace-contained string, for example: "/program/event/{id}". Nested references are
     * allowed as well, for example: "/accounts/{user.id}".
     */
    linkTemplate?: string;
}

/**
 * Props accepted by the <DataTableListView{Button,}Row> components.
 */
interface DataTableListViewRowProps<RowModel extends { /* object */ } = any> {
    /**
     * Height, in pixels, to apply to the list view row. Calculated from the `listViewProps`.
     */
    height: number;

    /**
     * Props given to the default list view component that's used in the responsive mobile display.
     */
    listViewProps: DataTableListViewProps<RowModel>;

    /**
     * URL that should be navigated to when the list item has been activated by the user.
     */
    onClick?: () => void;

    /**
     * The row that's being rendered in this list view.
     */
    row: GridRowModel<any>;
}

/**
 * The <DataTableListViewRow> component is the default list view component used in the <DataTable>
 * interface, which reads from the props (when available) to identify what should be shown. The
 * composition can have a primary and secondary text, an optional avatar or icon and an optional
 * date display. Note that individual components are able to provide their own row display.
 */
export function DataTableListViewRow(props: React.PropsWithChildren<DataTableListViewRowProps>) {
    const primaryField = props.listViewProps.primaryField ?? 'id';
    return (
        <Stack direction="row" spacing={2} onClick={props.onClick} sx={{
            alignItems: 'center',
            cursor: props.onClick ? 'pointer' : 'default',
            height: props.height,
        }}>

            { props.listViewProps.startComponent &&
                <props.listViewProps.startComponent row={props.row} listView /> }

            { /* TODO: Avatar */ }
            { /* TODO: Icon */ }

            <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography noWrap variant="body2" sx={{ fontWeight: 500 }}>
                    {props.row[primaryField]}
                </Typography>
                { !!props.listViewProps.secondaryField &&
                    <Typography noWrap variant="body2" color="textSecondary">
                        {props.row[props.listViewProps.secondaryField]}
                    </Typography> }
            </Stack>

            { !!props.listViewProps.dateField &&
                <Typography variant="body2" color="textSecondary" sx={{ flexShrink: 0 }}>
                    <LocalDateTime dateTime={props.row[props.listViewProps.dateField]}
                                   format={ props.listViewProps.dateFieldFormat ?? 'YYYY-MM-DD' } />
                </Typography>}

            { props.listViewProps.endComponent &&
                <props.listViewProps.endComponent row={props.row} listView /> }

            {props.children}

        </Stack>
    );
}

/**
 * The <DataTableListViewButtonRow> component wraps the default <DataTableListViewRow> component
 * with a full touch area through which the user can click through to a details page.
 */
export function DataTableListViewButtonRow(props: DataTableListViewRowProps) {
    const router = useRouter();
    const href = useMemo(() => resolveTemplatedUrl(props.row, props.listViewProps.linkTemplate), [
        props.listViewProps.linkTemplate,
        props.row,
    ]);

    const handleClick = useCallback(() => router.push(href), [ href, router ]);
    return (
        <DataTableListViewRow onClick={handleClick} {...props}>
            <NavigateNextIcon color="primary" fontSize="small" />
        </DataTableListViewRow>
    );
}

/**
 * Calculates the row height for items in a list view based on the given `props`. Will be applied
 * for both MUI X DataGrid's virtualisation (when used), and for setting a fixed height on each of
 * the rows part of the list view. We do not support dynamic row sizes at this point.
 *
 * We use 40px as minimum height, slightly above MUI's default for compact density, to adhere to
 * mobile platforms' guidelines regarding touch areas.
 *
 * @param props Properties that make up the list view row's composition.
 * @return Height, in pixels, for each of the list view row items.
 */
export function calculateListViewRowHeight(props: DataTableListViewRowProps['listViewProps']) {
    let listViewRowHeight = /* minimum= */ 40;

    // Increase the height when a secondary field should be displayed on the row:
    if (!!props.secondaryField)
        listViewRowHeight = 56;

    // TODO: Increase height when `props.avatar` or `props.icon` is set.
    return listViewRowHeight;
}
