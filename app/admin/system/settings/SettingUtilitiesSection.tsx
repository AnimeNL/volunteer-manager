// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import Button from '@mui/material/Button';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { dayjs } from '@lib/DateTime';

import { resetScheduleOverviewTiles } from './SettingActions';

/**
 * The <SettingUtilitiesSection> component displays a bunch of utilities that make dealing with the
 * settings easier, for example by calculating the number of seconds between two dates.
 */
export function SettingUtilitiesSection() {
    const [ dateTimeOffset, setDateTimeOffset ] = useState<number | undefined>();
    const [ resetError, setResetError ] = useState<string | undefined>();
    const [ resetLoading, setResetLoading ] = useState<boolean>(false);
    const [ resetResult, setResetResult ] = useState<number | undefined>();

    const handleDateTimePicked = useCallback((value: unknown) => {
        if (!dayjs.isDayjs(value)) {
            setDateTimeOffset(undefined);
            return;
        }

        const dayjsValue = value as dayjs.Dayjs;
        setDateTimeOffset(dayjsValue.diff(dayjs(), 'second'));

    }, [ /* no dependencies */ ]);

    const handleResetOverviewTiles = useCallback(async () => {
        setResetError(undefined);
        setResetLoading(true);
        try {
            const response = await resetScheduleOverviewTiles();
            if (response.success)
                setResetResult(response.clearedCount);
            else
                setResetError(response.error || 'Unable to clear dismissed tiles.');
        } finally {
            setResetLoading(false);
        }
    }, [ /* no dependencies */ ]);

    return (
        <Section icon={ <BuildCircleOutlinedIcon /> } title="Utilities">
            <SectionIntroduction>
                This section contains utilities that can help determine the value of aforementioned
                settings.
            </SectionIntroduction>
            <KeyValueList items={[
                {
                    key: 'Time offset calculator (UTC)',
                    description:
                        'Calculates the difference between the selected time and current time in ' +
                        'seconds, useful for time offset settings.',
                    keyAlign: 'center',
                    value: (
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                            <DateTimePicker slotProps={{ textField: { size: 'small' } }}
                                            onChange={handleDateTimePicked} />
                            { typeof dateTimeOffset === 'number' &&
                                <Typography variant="body2">
                                    <strong>Offset:</strong> {dateTimeOffset}
                                </Typography> }
                        </Stack>
                    ),
                    valueTemplate: 'component',
                },
                {
                    key: 'Reset dismissed overview tiles',
                    description:
                        'Clears all dismissed Ticket and Hotel overview tiles across all users.',
                    keyAlign: 'center',
                    value: (
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                            <Button loading={resetLoading}
                                    onClick={handleResetOverviewTiles}
                                    size="small"
                                    variant="outlined">
                                Reset across all users
                            </Button>
                            { typeof resetResult === 'number' &&
                                <Typography variant="body2" color="textSecondary">
                                    { resetResult === 0
                                        ? 'No dismissed tiles found.'
                                        : `Cleared ${resetResult} setting${resetResult === 1 ? '' : 's'}.` }
                                </Typography> }
                            { !!resetError &&
                                <Typography variant="body2" color="error">
                                    {resetError}
                                </Typography> }
                        </Stack>
                    ),
                    valueTemplate: 'component',
                },
            ]} />
        </Section>
    );
}
