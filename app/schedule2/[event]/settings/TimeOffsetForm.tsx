// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { updateScheduleTimeOffset } from './SettingsActions';

/**
 * Props accepted by the <TimeOffsetForm> component.
 */
interface TimeOffsetFormProps {
    eventSlug: string;
    hasOverride: boolean;
    initialDateTime: string;
    timeZone: string;
}

/**
 * Developer-only form allowing the signed-in user to simulate a different date and time in the
 * schedule portal without affecting other volunteers.
 */
export function TimeOffsetForm(props: TimeOffsetFormProps) {
    const router = useRouter();

    const [ dateTime, setDateTime ] = useState<string>(props.initialDateTime);
    const [ error, setError ] = useState<string | undefined>();
    const [ pending, setPending ] = useState<boolean>(false);

    async function applyDateTime(value: string | null) {
        setError(undefined);
        setPending(true);
        try {
            const response = await updateScheduleTimeOffset(props.eventSlug, value);
            if (response.success)
                router.refresh();
            else
                setError(response.error ?? 'Unable to update the simulated date.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Stack spacing={2}>
            <Stack spacing={0.5}>
                <Typography variant="subtitle1">
                    Simulated date and time
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Offset the schedule clock for your account ({props.timeZone}) to test the
                    portal as if the event were active.
                </Typography>
            </Stack>
            <TextField
                fullWidth
                label={`Date and time (${props.timeZone})`}
                onChange={event => setDateTime(event.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                type="datetime-local"
                value={dateTime} />
            <Stack direction="row" spacing={1}>
                <Button
                    disabled={pending || !dateTime}
                    loading={pending}
                    onClick={() => applyDateTime(dateTime)}
                    size="small"
                    variant="contained">
                    Apply
                </Button>
                <Button
                    disabled={pending || !props.hasOverride}
                    onClick={() => applyDateTime(null)}
                    size="small"
                    variant="outlined">
                    Reset
                </Button>
            </Stack>
            { !!error &&
                <Typography variant="body2" color="error">
                    {error}
                </Typography> }
        </Stack>
    );
}
