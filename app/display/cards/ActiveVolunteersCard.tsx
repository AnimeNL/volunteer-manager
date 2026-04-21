// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { DisplayShiftInfo } from '../DisplayContext';
import { Avatar } from '@app/components/Avatar';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <ActiveVolunteerCard> component.
 */
interface ActiveVolunteerCardProps {
    /**
     * Timezone in which any times should be displayed in the user interface.
     */
    timezone: string;

    /**
     * The volunteer for whom this card is being displayed.
     */
    volunteer: DisplayShiftInfo;
}

/**
 * The <ActiveVolunteerCard> component displays the necessary information of a particular volunteer
 * who is currently helping out at this location.
 */
function ActiveVolunteerCard(props: ActiveVolunteerCardProps) {
    const endZonedDateTime =
        Temporal.Instant.fromEpochMilliseconds(props.volunteer.end * 1000)
            .toZonedDateTimeISO(props.timezone);

    return (
        <Paper sx={{ px: 2, py: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar src={props.volunteer.avatar}>{props.volunteer.name}</Avatar>
                <Stack direction="column" sx={{ minWidth: 0 }}>
                    <Typography variant="body1">
                        {props.volunteer.name}
                    </Typography>
                    <Typography component="p" variant="caption" sx={{
                        color: 'text.disabled',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {props.volunteer.role}, until {formatDate(endZonedDateTime, 'HH:mm')}
                    </Typography>
                </Stack>
            </Stack>
        </Paper>
    );
}

/**
 * Props accepted by the <ActiveVolunteersCard> component.
 */
interface ActiveVolunteersCardProps {
    /**
     * Timezone in which any times should be displayed in the user interface.
     */
    timezone: string;

    /**
     * Volunteers that are currently active within this location.
     */
    volunteers: DisplayShiftInfo[];
}

/**
 * The <ActiveVolunteersCard> component shows the volunteers who are currently scheduled on this
 * shift, and are expected to be around. All information about these volunteers will be shown.
 */
export function ActiveVolunteersCard(props: ActiveVolunteersCardProps) {
    const size =
        props.volunteers.length <= 3 ? /* full width= */ 12 :
        props.volunteers.length <= 6 ? /* half width= */ 6 :
                                       /* third width= */ 4;

    return (
        <Grid container spacing={2} sx={{ m: '-8px !important', mb: '-16px !important' }}>
            { props.volunteers.map(volunteer =>
                <Grid key={volunteer.id} size={{ xs: size }}>
                    <ActiveVolunteerCard timezone={props.timezone} volunteer={volunteer} />
                </Grid> ) }
        </Grid>
    );
}
