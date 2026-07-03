// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { GridRowModel } from '@mui/x-data-grid-premium';

import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import Menu, { menuClasses } from '@mui/material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { RowModelFields } from './Types';
import { LocalDateTime } from '../LocalDateTime';
import { isProtectedRow, resolveRowModelField, resolveTemplate } from './Utilities';

/**
 * Props used to compose the list view presentation of a <DataTable> row.
 */
export interface DataTableListViewProps<RowModel extends object> {
    /**
     * Primary text on the list item. Will be displayed in bold and is guaranteed to not wrap.
     */
    primaryField: RowModelFields<RowModel>;

    /**
     * Secondary text on the list item. Guaranteed to not wrap.
     */
    secondaryField?: RowModelFields<RowModel>;

    /**
     * Template from which the secondary field will be derived. Can contain any of the fields as
     * a curly brace-contained string, for example: "Player #{id}". Nested references are allowed as
     * well, for example: "Issued by {user.name}".
     */
    secondaryTemplate?: string;

    /**
     * Date to display on the right-hand side of the list item.
     */
    dateField?: RowModelFields<RowModel>;

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
interface DataTableListViewRowProps<RowModel extends object = any> {
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
     * Callback when a row is requested to be deleted.
     */
    onDelete?: (row: GridRowModel<any>) => void;

    /**
     * Column through which it can be derived whether this row has been protected. Protected rows
     * cannot be deleted.
     */
    protectedColumn?: keyof RowModel & string;

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
    const primaryFieldValue = resolveRowModelField(props.row, props.listViewProps.primaryField);

    const isProtected = useMemo(() => isProtectedRow(props.row, props.protectedColumn), [
        props.row, props.protectedColumn,
    ]);

    // ---------------------------------------------------------------------------------------------
    // Mechanism through which the overflow menu can be accessed
    // ---------------------------------------------------------------------------------------------

    const [ menuAnchor, setMenuAnchor ] = useState<null | HTMLElement>(null);
    const [ menuEverOpened, setMenuEverOpened ] = useState<boolean>(false);

    const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setMenuEverOpened(true);

    }, [ /* no deps */ ]);

    const handleCloseMenu = useCallback((event?: any) => {
        setMenuAnchor(null);
        if (event)
            event?.stopPropagation();

    }, [ /* no deps */ ]);

    // ---------------------------------------------------------------------------------------------
    // Mechanism to request deletion of rows on a mobile device
    // ---------------------------------------------------------------------------------------------

    const handleDeleteClick = useCallback((event: React.MouseEvent) => {
        setMenuAnchor(null);
        event.stopPropagation();

        props.onDelete?.(props.row);

    }, [ props.onDelete, props.row ]);

    // ---------------------------------------------------------------------------------------------
    // Mechanism to request editing of rows on a mobile device
    // ---------------------------------------------------------------------------------------------

    const handleEditClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();

    }, [ /* no deps */]);

    // ---------------------------------------------------------------------------------------------

    return (
        <Stack direction="row" spacing={2} onClick={props.onClick} sx={{
            alignItems: 'center',
            cursor: props.onClick ? 'pointer' : 'default',
            height: props.height,
        }}>

            { props.listViewProps.startComponent &&
                <props.listViewProps.startComponent row={props.row} listView /> }

            <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography noWrap variant="body2" sx={{ fontWeight: 500 }}>
                    {primaryFieldValue}
                </Typography>
                { !!props.listViewProps.secondaryField &&
                    <Typography noWrap variant="body2" color="textSecondary">
                        {resolveRowModelField(props.row, props.listViewProps.secondaryField)}
                    </Typography> }
                { !!props.listViewProps.secondaryTemplate &&
                    <Typography noWrap variant="body2" color="textSecondary">
                        {resolveTemplate(props.row, props.listViewProps.secondaryTemplate)}
                    </Typography> }
            </Stack>

            { !!props.listViewProps.dateField &&
                <Typography variant="body2" color="textSecondary" sx={{ flexShrink: 0 }}>
                    <LocalDateTime
                        dateTime={resolveRowModelField(props.row, props.listViewProps.dateField)}
                        fixedWidth format={ props.listViewProps.dateFieldFormat ?? 'YYYY-MM-DD' } />
                </Typography>}

            { props.listViewProps.endComponent &&
                <props.listViewProps.endComponent row={props.row} listView /> }

            { !!props.onDelete && (
                <>
                    <IconButton aria-label="Actions" size="small" onClick={handleOpenMenu}
                                sx={{ mr: -1 }}>
                        <MoreVertIcon fontSize="small" />
                    </IconButton>
                    { !!menuEverOpened &&
                        <IconMenu anchorEl={menuAnchor} open={!!menuAnchor}
                                  onClose={handleCloseMenu}
                                  anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
                                  transformOrigin={{ vertical: 'center', horizontal: 'right' }}>
                            <IconButton component="li" disabled onClick={handleEditClick}
                                        aria-label="Edit">
                                <EditIcon color="disabled" fontSize="medium" />
                            </IconButton>
                            { !isProtected &&
                                <IconButton component="li" onClick={handleDeleteClick}
                                            aria-label="Delete">
                                    <DeleteForeverIcon color="error" fontSize="medium" />
                                </IconButton> }
                            { !!isProtected &&
                                <IconButton component="li" disabled>
                                    <DeleteForeverIcon color="disabled" fontSize="medium" />
                                </IconButton> }
                        </IconMenu> }
                </>
            )}

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
    const href = useMemo(() => resolveTemplate(props.row, props.listViewProps.linkTemplate), [
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
 * Styled variant of the <Menu> component that's appropriate for horizontal icon listing.
 */
const IconMenu = styled(Menu)(({ theme }) => ({
    [`& .${menuClasses.list}`]: {
        display: 'flex',
        padding: theme.spacing(1, 1),
    },
}));

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
    if (!!props.secondaryField || !!props.secondaryTemplate)
        listViewRowHeight = 56;

    return listViewRowHeight;
}
