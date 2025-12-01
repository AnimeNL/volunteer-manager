// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState } from 'react';

import type { FieldValues } from '@proxy/react-hook-form-mui';
import type { ValueOptions } from '@mui/x-data-grid-pro';
import Grid from '@mui/material/Grid';

import { MuiColorInput } from 'mui-color-input';
import { SelectElement, TextareaAutosizeElement } from '@proxy/react-hook-form-mui';

import type { EventShiftContext, EventShiftRowModel } from '@app/api/admin/event/shifts/[[...id]]/route';
import { ShiftSettingsForm } from '../ShiftSettingsForm';
import { callApi } from '@lib/callApi';

import { kExcitementOptions } from '@app/admin/components/ExcitementIcon';

/**
 * Options available for expected shift overlap. Warnings will be based on this option.
 */
const kOverlapOptions: ValueOptions[] = [
    { id: 'None', label: 'No overlap with timeslots is required' },
    { id: 'Partial', label: 'All timeslots need partial coverage' },
    { id: 'Cover', label: 'All timeslots need full coverage' },
];

/**
 * Props accepted by the <ShiftSettingsSection> component.
 */
interface ShiftSettingsSectionProps extends EventShiftContext {
    /**
     * The activities that can be selected when creating this shift.
     */
    activities: { id: number; label: string }[];

    /**
     * The categories of shifts that can be selected when creating a new one.
     */
    categories: { id: number; label: string }[];

    /**
     * The locations within which shifts of our own initiative can be located.
     */
    locations: { id: number; label: string }[];

    /**
     * Whether the form should be in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Default values that should be applied to the form, if any.
     */
    shift: Omit<EventShiftRowModel, 'colour'> & { colour?: string; };
}

/**
 * The <ShiftSettingsSection> component enables a lead (w/ sufficient access) to change the settings
 * associated with a particular shift. This influences how it will appear in the interface, and
 * eventually to volunteers.
 */
export function ShiftSettingsSection(props: ShiftSettingsSectionProps) {
    const { readOnly } = props;

    const [ colour, setColour ] = useState<string>(props.shift.colour ?? '#ffffff');
    const [ invalidated, setInvalidated ] = useState<boolean>(false);

    const handleChange = useCallback(() => setInvalidated(true), [ /* no dependencies */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        const response = await callApi('put', '/api/admin/event/shifts/:id', {
            context: props.context,
            id: props.shift.id,
            row: {
                id: props.shift.id,
                name: data.name,
                activityId: data.activityId,
                categoryId: data.categoryId,
                locationId: data.locationId,
                colour: colour || '#ffffff',  // defaults to #ffffff for no override
                description: data.fields.description,
                demandOverlap: data.fields.overlap,
                excitement: data.fields.excitement,

                category: '',  // ignored
                categoryOrder: 0,  // ignored
            },
        });

        if (!response.success)
            throw new Error(response.error ?? 'The shift could not be updated in the database.');

        setInvalidated(false);

    }, [ colour, props.context, props.shift ]);

    const handleColourChange = useCallback((colour: string) => {
        setColour(colour);
        setInvalidated(true);
    }, [ /* no dependencies */ ]);

    // Reset the colour when another shift is being rendered.
    useEffect(() => setColour(props.shift.colour ?? '#ffffff'), [ props.shift.colour ]);

    return (
        <ShiftSettingsForm {...props} includeName invalidated={invalidated}
                           onSubmit={handleSubmit}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 6 }}>
                    <SelectElement name="excitement" label="Excitement level" fullWidth required
                                   options={kExcitementOptions} size="small" type="number"
                                   disabled={readOnly} onChange={handleChange} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <MuiColorInput format="hex" value={colour} label="Override colour" fullWidth
                                   size="small" isAlphaHidden disabled={readOnly}
                                   sx={{ '& input[value="#ffffff"]': { color: 'transparent' } }}
                                   fallbackValue="#ffffff" onChange={handleColourChange} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="overlap" label="Timeslot overlap" fullWidth required
                                   options={kOverlapOptions} size="small" disabled={readOnly}
                                   onChange={handleChange} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextareaAutosizeElement name="description" label="Description"
                                             size="small" fullWidth disabled={readOnly}
                                             onChange={handleChange} />
                </Grid>
            </Grid>
        </ShiftSettingsForm>
    );
}
