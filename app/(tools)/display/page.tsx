// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActiveVolunteersCard } from './cards/ActiveVolunteersCard';
import { AdviceCard } from './cards/AdviceCard';
import { DisplayContext } from './DisplayContext';
import { FutureVolunteersCard } from './cards/FutureVolunteersCard';
import { NoVolunteersCard } from './cards/NoVolunteersCard';
import { RequestHelpCard } from './cards/RequestHelpCard';

/**
 * Page to display when the display is still loading, and no context has been made available at all.
 */
function LoadingDisplayPage() {
    return (
        <Stack component={Paper} direction="column" spacing={4} sx={{
            alignItems: 'center',
            flexGrow: 1,
            justifyContent: 'center',
            padding: 2
        }}>
            <CircularProgress color="secondary" size={80} thickness={2} />
            <Typography>
                The display is being provisioned…
            </Typography>
        </Stack>
    );
}

/**
 * Page to display when the display has loaded, but has not been provisioned yet. The `identifier`
 * is given by the server, and should help seniors to identify which display it is.
 */
function UnprovisionedDisplayPage(props: { identifier: string }) {
    return (
        <Stack component={Paper} direction="column" spacing={2} sx={{
            alignItems: 'center',
            flexGrow: 1,
            justifyContent: 'center',
            padding: 2
        }}>
            <Typography variant="button" sx={{ fontSize: '8rem' }}>
                {props.identifier}
            </Typography>
            <Typography>
                This display has not been provisioned yet.
            </Typography>
            <Typography>
                Please reach out to <strong>Ferdi</strong> or <strong>Peter</strong> to enable the
                display for use during the festival.
            </Typography>
        </Stack>
    );
}

/**
 * The <DisplayPage> is the main page of the Display app, which powers the physical devices we will
 * position around the event's location. It's an 1280x800 pixel screen that we should assume can be
 * seen by volunteers and visitors alike. Information will exclusively be sourced from the display
 * context, which is responsible for managing our state.
 */
export default function DisplayPage() {
    const display = useContext(DisplayContext);
    if (!display.context)
        return <LoadingDisplayPage />;

    if (!display.context.provisioned)
        return <UnprovisionedDisplayPage identifier={display.context.identifier} />;

    return (
        <Grid container>
            <Grid size={{ xs: 8 }}>
                <Stack direction="column" spacing={4} sx={{ mr: 4 }}>

                    { !display.context.schedule.active.length && <NoVolunteersCard /> }
                    { !!display.context.schedule.active.length &&
                        <ActiveVolunteersCard volunteers={display.context.schedule.active}
                                              timezone={display.context.config.timezone} /> }

                    { (!!display.context.schedule.future.length && !!display.context.event) &&
                        <FutureVolunteersCard event={display.context.event}
                                              schedule={display.context.schedule}
                                              timezone={display.context.config.timezone} /> }

                </Stack>
            </Grid>
            <Grid size={{ xs: 4 }}>
                <Stack direction="column" spacing={4}>
                    { !!display.context.config.enableRequestHelp &&
                        <RequestHelpCard enableAdvice={!!display.context.config.enableRequestAdvice}
                                         status={display.context.helpRequestStatus} /> }
                    { !!display.context.nardo &&
                        <AdviceCard advice={display.context.nardo} /> }
                </Stack>
            </Grid>
        </Grid>
    );
}
