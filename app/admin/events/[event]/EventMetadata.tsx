// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { PageInfo } from '../verifyAccessAndFetchPageInfo';
import { isAfter, isBefore } from '@lib/Temporal';

/**
 * Formats the difference between `from` and `to`.
 */
function formatTimeDifference(from: Temporal.ZonedDateTime, to: Temporal.ZonedDateTime) {
    const suffix = isAfter(from, to) ? ' ago' : '';

    const earliest = isBefore(from, to) ? from : to;
    const latest = isBefore(from, to) ? to : from;

    function formatResponse(difference: number, unit: string, suffix: string) {
        return {
            difference,
            unit: `${unit}${difference !== 1 ? 's' : ''}${suffix}`,
        };
    }

    const differenceDays = latest.since(earliest, { largestUnit: 'days' }).days;
    if (differenceDays >= 7 * 52) {
        return formatResponse(
            latest.since(earliest, { largestUnit: 'years' }).years, 'year', suffix);
    } else if (differenceDays >= 7 * 8) {
        return formatResponse(
            latest.since(earliest, { largestUnit: 'weeks' }).weeks, 'week', suffix);
    } else if (differenceDays >= 2) {
        return formatResponse(differenceDays, 'day', suffix);
    }

    const differenceHours = latest.since(earliest, { largestUnit: 'hours' }).hours;
    if (differenceHours >= 2) {
        return formatResponse(differenceHours, 'hour', suffix);
    } else {
        return formatResponse(
            latest.since(earliest, { largestUnit:  'minutes' }).minutes, 'minute', suffix);
    }
}

/**
 * Props accepted by the <EventDateTicker> component.
 */
interface EventDateTickerProps {
    /**
     * Date and time on which the event is scheduled to commence.
     */
    startTime: string;

    /**
     * Date and time on which the event is scheduled to conclude.
     */
    endTime: string;
}

/**
 * Displays a date and/or time ticker towards the event's starting time. This component has three
 * distinct states: (1) future event, (2) current event, (3) past event.
 */
function EventDateTicker(props: EventDateTickerProps) {
    const currentTime = Temporal.Now.zonedDateTimeISO('UTC');

    const startTime = Temporal.ZonedDateTime.from(props.startTime);
    const endTime = Temporal.ZonedDateTime.from(props.endTime);

    let color: string | undefined = undefined;
    let difference: number;
    let unit: string;

    if (isBefore(currentTime, startTime)) {
        ({ difference, unit } = formatTimeDifference(currentTime, startTime));
    } else if (isBefore(currentTime, endTime)) {
        ({ difference, unit } = formatTimeDifference(currentTime, endTime));
        color = 'success.main';
    } else {
        ({ difference, unit } = formatTimeDifference(currentTime, endTime));
        color = 'error.main';
    }

    return (
        <Stack direction="column">
            <Typography variant="h6" align="center" sx={{ color }}>
                {difference}
            </Typography>
            <Typography variant="subtitle2" align="center" sx={{ color }}>
                {unit}
            </Typography>
        </Stack>
    );
}

/**
 * Props accepted by the <EventMetadata> component.
 */
interface EventMetadataProps {
    /**
     * Information about the event that's being shown.
     */
    event: PageInfo['event'];

    /**
     * Metadata about this event that is to be shown on the overview page.
     */
    metadata?: {
        /**
         * Number of people that we are booking hotel rooms for.
         */
        hotelAssignments: number;

        /**
         * Number of hotel rooms that we are booking
         */
        hotelBookings: number;

        /**
         * Number of hotel rooms that volunteers can choose from.
         */
        hotelOptions: number;

        /**
         * Number of participants across all the training sessions.
         */
        trainingAssignments: number;

        /**
         * Number of training sessions we are planning for this event.
         */
        trainingSessions: number;
    };

    /**
     * Whether hotel management is enabled for this event.
     */
    hotelEnabled: boolean;

    /**
     * Whether training management is enabled for this event.
     */
    trainingEnabled: boolean;
}

/**
 * The <EventMetadata> component displays metadata about the event that's being shown, such as when
 * it will happen and progression on gathering hotel and training preferences.
 */
export function EventMetadata(props: EventMetadataProps) {
    const { event, metadata } = props;

    const hotelColor = event.hotelInformationPublished ? 'success' : 'error';
    const hotelText =
        event.hotelInformationPublished ? 'Hotel data has been published'
                                        : 'Hotel data has not been published';

    const trainingColor = event.trainingInformationPublished ? 'success' : 'error';
    const trainingText =
        event.trainingInformationPublished ? 'Training data has been published'
                                           : 'Training data has not been published';

    // ---------------------------------------------------------------------------------------------
    // Compose text for hotel information
    // ---------------------------------------------------------------------------------------------

    let hotel: string;
    if (metadata?.hotelAssignments && metadata?.hotelBookings) {
        hotel =
            `${metadata.hotelAssignments} volunteers will stay in ` +
            `${metadata.hotelBookings} hotel rooms`;
    } else if (metadata?.hotelAssignments && metadata?.hotelOptions) {
        hotel =
            `${metadata.hotelAssignments} volunteers have chosen from ` +
            `${metadata.hotelOptions} hotel room options`;
    } else if (metadata?.hotelOptions) {
        hotel = `${metadata.hotelOptions} hotel room options are being planned`;
    } else {
        hotel = 'Hotel room planning has not begun yet.';
    }

    // ---------------------------------------------------------------------------------------------
    // Compose text for training information
    // ---------------------------------------------------------------------------------------------

    let training: string;
    if (metadata?.trainingSessions && metadata?.trainingAssignments) {
        training =
            `${metadata.trainingAssignments} volunteers will participate in ` +
            `${metadata.trainingSessions} training sessions`;
    } else if (metadata?.trainingSessions) {
        training = `${metadata?.trainingSessions} training sessions are being planned`
    } else {
        training = 'Training planning has not begun yet';
    }

    return (
        <Paper sx={{ display: 'flex', minHeight: '100%', p: 2 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}
                   divider={ <Divider orientation="vertical" flexItem /> }>
                <EventDateTicker startTime={event.startTime} endTime={event.endTime} />
                <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {event.name}
                    </Typography>
                    { (props.hotelEnabled || props.trainingEnabled) &&
                        <List dense disablePadding>
                            { props.hotelEnabled &&
                                <ListItem disableGutters disablePadding>
                                    <ListItemIcon sx={{ minWidth: '40px' }}>
                                        <Tooltip title={hotelText}>
                                            <HotelIcon fontSize="small" color={hotelColor} />
                                        </Tooltip>
                                    </ListItemIcon>
                                    <ListItemText>
                                        {hotel}
                                    </ListItemText>
                                </ListItem> }
                            { props.trainingEnabled &&
                                <ListItem disableGutters disablePadding>
                                    <ListItemIcon sx={{ minWidth: '40px' }}>
                                        <Tooltip title={trainingText}>
                                            <HistoryEduIcon fontSize="small"
                                                            color={trainingColor} />
                                        </Tooltip>
                                    </ListItemIcon>
                                    <ListItemText>
                                        {training}
                                    </ListItemText>
                                </ListItem> }
                        </List> }
                </Box>
            </Stack>
        </Paper>
    );
}
