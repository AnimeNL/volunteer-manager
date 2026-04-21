// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Grid from '@mui/material/Grid';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import Paper from '@mui/material/Paper';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import Stack from '@mui/material/Stack';
import StarRateOutlinedIcon from '@mui/icons-material/StarRateOutlined';
import Typography from '@mui/material/Typography';

import type { DisplayShiftInfo } from '../DisplayContext';
import { Temporal, formatDate } from '@lib/Temporal';
import { VolunteersDialog } from './VolunteersDialog';

/**
 * Number of entries to display on the future volunteer list.
 */
const kFutureVolunteerEntryLimit = 9;

/**
 * Props accepted by the <FutureVolunteersCard> component.
 */
interface FutureVolunteersCardProps {
    /**
     * Information about the event for which the dialog is being shown.
     */
    event: { start: string; end: string; };

    /**
     * Volunteers that will be helping out in this location.
     */
    schedule: {
        past: DisplayShiftInfo[];
        active: DisplayShiftInfo[];
        future: DisplayShiftInfo[];
    };

    /**
     * Timezone in which any times should be displayed in the user interface.
     */
    timezone: string;
}

/**
 * The <FutureVolunteersCard> component shows the volunteers who are expected to help out at this
 * location in the near future. Limited information will be shown.
 */
export function FutureVolunteersCard(props: FutureVolunteersCardProps) {
    const { schedule, timezone } = props;

    // ---------------------------------------------------------------------------------------------

    // Identify the group of volunteers who are due to help out next. This could be a single person,
    // it could also be a group of multiple people.
    const upcoming = useMemo(() => {
        const volunteers: DisplayShiftInfo[] = [ /* empty */ ];
        for (const volunteer of schedule.future) {
            if (!!volunteers.length && volunteers[0].start !== volunteer.start)
                break;  // the volunteer starts at a different moment

            volunteers.push(volunteer);

            if (volunteers.length >= kFutureVolunteerEntryLimit)
                break;  // the volunteer limit would be exceeded
        }

        if (!volunteers)
            return undefined;

        return {
            dt: Temporal.Instant.fromEpochMilliseconds(volunteers[0].start * 1000)
                .toZonedDateTimeISO(timezone),
            volunteers,
        };

    }, [ timezone, schedule ]);

    // ---------------------------------------------------------------------------------------------

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    if (!upcoming)
        return undefined;

    return (
        <>
            <CardActionArea onClick={handleDialogOpen}>
                <Stack component={Paper} direction="column" spacing={2} sx={{ pt: 2 }}>
                    <Stack direction="row" sx={{ px: 2 }}>
                        <Typography variant="body1" sx={{ pt: 1, width: '100px' }}>
                            { formatDate(upcoming.dt, 'HH:mm') }
                        </Typography>
                        <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                            { upcoming.volunteers.map(volunteer =>
                                <Grid key={volunteer.id} size={{ xs: 4 }}>
                                    <Paper variant="outlined"
                                           sx={{ p: 1, borderColor: 'transparent '}}>
                                        <Stack direction="row"
                                               sx={{ justifyContent: 'space-between' }}>
                                            <Typography variant="body1">
                                                {volunteer.name}
                                            </Typography>
                                            <Stack direction="row" spacing={1}
                                                   sx={{ alignItems: 'center' }}>
                                                { volunteer.team.includes('Host') &&
                                                    <LightbulbOutlinedIcon htmlColor="#455a64"
                                                                           fontSize="small" /> }
                                                { volunteer.team.includes('Steward') &&
                                                    <SecurityOutlinedIcon htmlColor="#455a64"
                                                                          fontSize="small" /> }
                                                { volunteer.role.includes('Senior') &&
                                                    <StarRateOutlinedIcon htmlColor="#ffeb3b"
                                                                          fontSize="small" /> }
                                                { volunteer.role.includes('Staff') &&
                                                    <StarRateOutlinedIcon htmlColor="#ff5722"
                                                                          fontSize="small" /> }
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                </Grid> ) }
                        </Grid>
                    </Stack>
                    <Box sx={{
                        backgroundColor: '#004e8b',
                        borderBottomLeftRadius: 4,
                        borderBottomRightRadius: 4,
                        height: '12px',
                        lineHeight: 0.6,
                        textAlign: 'center' }}>
                        …
                    </Box>
                </Stack>
            </CardActionArea>
            <VolunteersDialog onClose={handleDialogClose} event={props.event} open={dialogOpen}
                              schedule={schedule} timezone={timezone} />
        </>
    );
}
