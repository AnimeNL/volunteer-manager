// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { deepmerge } from '@mui/utils';

/**
 * Custom styles applied to the <AdminHeader> & related components.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    legend: {
        borderRadius: theme => Number(theme.shape.borderRadius) / 2,
        height: '18px',
        width: theme => theme.spacing(4),
    },

    timeline: {
        border: '1px solid red',
        borderColor: 'divider',
        borderRadius: theme => Number(theme.shape.borderRadius) / 2,
        color: 'text.disabled',
    },

    timelineBox: {
        flex: 1,
        fontSize: '.75em',
        lineHeight: '2.25em',
        overflow: 'hidden',
        textAlign: 'center',

        '&:first-child': {
            borderTopLeftRadius: theme => `${theme.shape.borderRadius}px`,
            borderBottomLeftRadius: theme => `${theme.shape.borderRadius}px`,
        },
        '&:last-child': {
            borderTopRightRadius: theme => `${theme.shape.borderRadius}px`,
            borderBottomRightRadius: theme => `${theme.shape.borderRadius}px`,
        },
    },

    available: { backgroundColor: theme => theme.palette.mode === 'dark' ? '#689F38' : '#8BC34A' },
    avoid: { backgroundColor: theme => theme.palette.mode === 'dark' ? '#33691E' : '#DCEDC8' },
    unavailable: { backgroundColor: theme => theme.palette.mode === 'dark' ? '#455A64' : '#B0BEC5' }
};

/**
 * The expectation for a particular hour.
 */
export type AvailabilityExpectation = 'available' | 'avoid' | 'unavailable';

/**
 * Visual label used to explain what a particular colour means.
 */
const kAvailabilityLabel: { [k in AvailabilityExpectation]: string } = {
    available: 'May get shifts',
    avoid: 'We\'ll avoid',
    unavailable: 'No shifts',
};

/**
 * Displays a component to explain what a particular colour means.
 */
export function AvailabilityLegend(props: { expectation: AvailabilityExpectation }) {
    return (
        <Stack direction="row" spacing={2}>
            <Box sx={deepmerge(kStyles.legend, kStyles[props.expectation])}>
                &nbsp;
            </Box>
            <Typography variant="caption">
                {kAvailabilityLabel[props.expectation]}
            </Typography>
        </Stack>
    );
}

/**
 * Visual tooltip title to explain to the volunteer what this availability colour means.
 */
const kAvailabilityTitles: { [k in AvailabilityExpectation]: string } = {
    available: 'We\'ll consider you when scheduling shifts',
    avoid: 'We\'ll try to avoid scheduling you for a shift',
    unavailable: 'You won\'t receive any shifts',
};

/**
 * Box displaying the expectation for a particular hour. Draws both the background and some styling
 * to indicate what we expect from the volunteer.
 */
function AvailabilityExpectation(props: { expectation: AvailabilityExpectation; hour: number }) {
    const { expectation, hour } = props;

    const hourDescription = `${`0${hour}`.substr(-2)}:00–${`0${(hour + 1) % 24}`.substr(-2)}:00`;

    return (
        <Tooltip title={`${kAvailabilityTitles[expectation]} (${hourDescription})`}>
            <Typography sx={deepmerge(kStyles.timelineBox, kStyles[expectation])}>
                {`0${hour}`.substr(-2)}
            </Typography>
        </Tooltip>
    );
}

/**
 * Information about an individual day during which we expect the volunteer to be around.
 */
export interface AvailabilityDayInfo {
    /**
     * Label using which the day should be identified.
     */
    label: string;

    /**
     * The expectations for this particular day.
     */
    expectations: AvailabilityExpectation[];
}

/**
 * Representst the availability information of a singular day. The label has already been drawn,
 * this component should use the available width to give a clear overview of a 24 hour period.
 */
export function AvailabilityExpectationDay(props: { info: AvailabilityDayInfo }) {
    return (
        <Box>
            <Stack direction="row" alignItems="stretch" sx={kStyles.timeline}
                   divider={ <Divider orientation="vertical" flexItem /> }>
                { [ ...Array(24) ].map((_, index) =>
                    <AvailabilityExpectation hour={index} key={index}
                                             expectation={props.info.expectations[index]} /> )}
            </Stack>
        </Box>
    );
}
