// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { SelectElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

/**
 * Props accepted by the <TrainingForm> component.
 */
interface TrainingFormProps {
    /**
     * Whether form fields should be rendered in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Training options available for this event.
     */
    trainings: { id: number; label: string; }[];
}

/**
 * Form through which a volunteer's training preferences can be managed.
 */
export function TrainingForm(props: TrainingFormProps) {
    const { readOnly, trainings } = props;

    const options = useMemo(() => [
        { id: 0, label: 'No, I will skip this year' },
        ...trainings,
    ], [ trainings ]);

    return (
        <>
            <Grid size={{ xs: 12 }}>
                <SelectElement name="trainingId" label="Would you to participate in the training?"
                               options={options} fullWidth size="small" required
                               slotProps={{ input: { readOnly } }} />
            </Grid>
        </>
    );
}
