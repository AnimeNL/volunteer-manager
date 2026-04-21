// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { dayjs } from '@lib/DateTime';

/**
 * The <SettingUtilitiesSection> component displays a bunch of utilities that make dealing with the
 * settings easier, for example by calculating the number of seconds between two dates.
 */
export function SettingUtilitiesSection() {
    const [ dateTimeOffset, setDateTimeOffset ] = useState<number | undefined>();

    const handleDateTimePicked = useCallback((value: unknown) => {
        if (!dayjs.isDayjs(value))
            throw new Error(`Expected a DayJS instance, got (typeof=${typeof value}): ${value}`);

        const dayjsValue = value as dayjs.Dayjs;
        setDateTimeOffset(dayjsValue.diff(dayjs(), 'second'));

    }, [ /* no dependencies */ ]);

    return (
        <Section icon={ <BuildCircleOutlinedIcon color="primary" /> } title="Utilities">
            <SectionIntroduction>
                This section contains utilities that can help determine the value of aforementioned
                settings.
            </SectionIntroduction>
            <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
                <Typography variant="h6">
                    Time offset calculator (UTC)
                </Typography>
                <Stack direction="row" spacing={2} sx={{
                    alignItems: 'center',
                    paddingTop: 1,
                    paddingBottom: .5
                }}>
                    <DateTimePicker slotProps={{ textField: { size: 'small' } }}
                                    onChange={handleDateTimePicked} />
                    { !!dateTimeOffset &&
                        <Typography variant="subtitle1">
                            <strong>Offset</strong>: {dateTimeOffset}
                        </Typography> }
                </Stack>
            </Paper>
        </Section>
    )
}
