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

/**
 * Props accepted by the <DataTableListView{Button,}Row> components.
 */
interface DataTableListViewRowProps {
    /**
     * Props given to the default list view component that's used in the responsive mobile display.
     */
    listViewProps?: {
        primaryField: string;
        secondaryField?: string;
        dateField?: string;
        linkTemplate?: string;
    };

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
    const primaryField = props.listViewProps?.primaryField ?? 'id';
    return (
        <Stack direction="row" spacing={2} onClick={props.onClick} sx={{
            alignItems: 'center',
            cursor: props.onClick ? 'pointer' : 'default',
            height: '100%',
        }}>

            { /* TODO: Avatar */ }
            { /* TODO: Icon */ }

            <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography noWrap variant="body2" sx={{ fontWeight: 500 }}>
                    {props.row[primaryField]}
                </Typography>
                { props.listViewProps?.secondaryField &&
                    <Typography noWrap variant="body2" color="textSecondary">
                        {props.row[props.listViewProps.secondaryField]}
                    </Typography> }
            </Stack>

            { props.listViewProps?.dateField &&
                <Typography variant="body2" color="textSecondary">
                    <LocalDateTime dateTime={props.row[props.listViewProps.dateField]}
                                   format="YYYY-MM-DD" />
                </Typography>}

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
    const href = useMemo(() => resolveListViewUrl(props.row, props.listViewProps?.linkTemplate), [
        props.listViewProps,
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
 * Resolves the given `template` URL based on the given `row`. All fields in the `row` will be
 * considered as a substitute, and a path may be used to discover nested references.
 */
function resolveListViewUrl(row: GridRowModel<any>, template?: string): string {
    if (!template)
        return '#';

    return template.replace(/\{([^}]+)\}/g, (match, path) => {
        const value = path.split('.').reduce((object: any, key: string) => {
            return object && object[key] !== undefined ? object[key] : undefined;
        }, row);

        return value !== undefined ? String(value) : match;
    });
}
