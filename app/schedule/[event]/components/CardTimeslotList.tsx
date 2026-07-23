// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import DoneAllIcon from '@mui/icons-material/DoneAll';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CardTimeslotEntry, type CardTimeslot } from './CardTimeslotEntry';

/**
 * Props accepted by the <CardTimeslotList> component.
 */
interface CardTimeslotListProps {
    /**
     * Current Temporal ZonedDateTime based on which timing calculations will be done.
     */
    currentTime: Temporal.ZonedDateTime;

    /**
     * Text to display when no events could be found. Defaults to "No further events have been
     * scheduled…".
     */
    noEventsText?: string;

    /**
     * URL prefix to apply to all links shown in the list.
     */
    prefix: string;

    /**
     * The timeslots to display on this card, in display order.
     */
    timeslots: CardTimeslot[];
}

/**
 * The <CardTimeslotList> component shows a list of timeslots in the layout appropriate for area or
 * location cards. This component imposes no limit on the number of timeslots to be shown.
 */
export function CardTimeslotList(props: CardTimeslotListProps) {
    if (!props.timeslots.length) {
        return (
            <Paper variant="outlined" sx={{ p: 1, mx: 1, mb: 1,
                                            backgroundColor: 'background.paper' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <DoneAllIcon color="success" fontSize="small" />
                    <Typography variant="body2">
                        { props.noEventsText ?? 'No further events have been scheduled' }
                    </Typography>
                </Stack>
            </Paper>
        );
    } else {
        return (
            <List dense disablePadding>
                { props.timeslots.map(timeslot =>
                    <CardTimeslotEntry key={timeslot.id} currentTime={props.currentTime}
                                       prefix={props.prefix} timeslot={timeslot} /> ) }
            </List>
        );
    }
}
