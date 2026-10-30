// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { GridValidRowModel } from '@mui/x-data-grid-premium';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import Tooltip from '@mui/material/Tooltip';

import { resolveRowModelField } from '../Utilities';

/**
 * Context that can be given to the <BooleanHeader> and <BooleanCell> components, used to indicate
 * which fields from the row model should be consulted, and what the value is for.
 */
export interface BooleanCellContext {
    /**
     * Field for which the truthiness should be tested.
     */
    field: string;

    /**
     * Tooltips to display as part of the icon, contextualising what's going on.
     */
    tooltips?: {
        /**
         * Tooltip to display in the table's header, what is this column about?
         */
        header?: string;

        /**
         * Tooltip to display for rows that have a falsy value.
         *
         * @default "Disabled"
         */
        falsyValue?: string;

        /**
         * Tooltip to display for rows that have a truthy value.
         *
         * @default "Enabled"
         */
        truthyValue?: string;

        /**
         * Tooltip to display for rows that don't have a value set.
         *
         * @default "Undecided"
         */
        undefinedValue?: string;
    };
}

/**
 * Header component for a boolean column.
 */
export function BooleanHeader(props: { context?: BooleanCellContext }) {
    if (typeof props.context?.tooltips?.header !== 'string')
        throw new Error('Component context must be given for the <Boolean{Cell,Header} />');

    return (
        <Tooltip title={props.context.tooltips.header}>
            <CircleOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Props accepted by the <BooleanCell> component.
 */
export interface BooleanCellProps {
    /**
     * The context configuring the field and tooltips for this cell.
     */
    context?: BooleanCellContext;

    /**
     * The row that should be rendered.
     */
    row: GridValidRowModel;
}

/**
 * Component to display the true / false / undefined status of a value.
 */
export function BooleanCell(props: BooleanCellProps) {
    const value = resolveRowModelField(props.row, props.context?.field || 'id');
    if (value === null || value === undefined) {
        return (
            <Tooltip title={ props.context?.tooltips?.undefinedValue || 'Undecided' }>
                <CircleOutlinedIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    } else if (!!value) {
        return (
            <Tooltip title={ props.context?.tooltips?.truthyValue || 'Enabled' }>
                <CheckCircleOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title={ props.context?.tooltips?.falsyValue || 'Disabled' }>
                <HighlightOffOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}
