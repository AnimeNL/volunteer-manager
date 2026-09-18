// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import { CheckboxElement, useFormContext } from '@components/proxy/react-hook-form-mui';

import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

/**
 * Props accepted by the <Flag> component.
 */
export interface FlagProps {
    /**
     * Name of the field that will be used to represent this flag.
     */
    field: string;

    /**
     * Whether the flag should be displayed in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Title of the flag. What does it do?
     */
    title: string;

    /**
     * Optional description that should be included in the UI.
     */
    description?: string;
}

/**
 * The <Flag> component is a <ListItemButton> that wraps a checkbox, with a little bit of client-
 * side logic so that the entire surface area can be used to flip its value.
 */
export function Flag(props: FlagProps) {
    const { getValues, setValue } = useFormContext();

    const handleClick = useCallback(() => {
        if (!props.readOnly)
            setValue(props.field, !getValues(props.field), { shouldDirty: true });

    }, [ getValues, props.field, props.readOnly, setValue ]);

    return (
        <ListItemButton onClick={handleClick} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 'auto' }}>
                <CheckboxElement name={props.field} edge="start" disabled={props.readOnly}
                                 disableRipple />
            </ListItemIcon>
            <ListItemText primary={props.title} secondary={props.description} />
        </ListItemButton>
    );
}
