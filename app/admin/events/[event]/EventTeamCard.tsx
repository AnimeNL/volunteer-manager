// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { useCallback, useState } from 'react';

import Box, { type BoxProps } from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Paper from '@mui/material/Paper';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <TeamIdentityHeader> component.
 */
interface TeamIdentityHeaderProps extends BoxProps {
    /**
     * Background color reflecting the team's identity.
     */
    backgroundColor: string;
};

/**
 * The <TeamIdentityHeader> component displays a box appropriately coloured in the team's identity,
 * with a font colour that provides an appropriate amount of context.
 */
const TeamIdentityHeader = styled((props: TeamIdentityHeaderProps) => {
    // biome-ignore lint/correctness/noUnusedVariables: strip internal prop
    const { backgroundColor, ...boxProps } = props;
    return <Box {...boxProps} />;
})(({ backgroundColor, theme }) => ({
    backgroundColor,
    color: theme.palette.getContrastText(backgroundColor),
    borderRadius: theme.shape.borderRadius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
}));

/**
 * The <TeamIdentityFooter> component displays a box similarly themed after the team's identity, but
 * for usage at the bottom of another component.
 */
const TeamIdentityFooter = styled(TeamIdentityHeader)(({ theme }) => ({
    borderRadius: theme.shape.borderRadius,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginBottom: '-1px !important',
    height: '1rem',
}));

/**
 * Props accepted by the <EventTeamCard> component.
 */
interface EventTeamCardProps {
    /**
     * The graph that should be shown as the team's history graph.
     */
    graph: React.ReactNode;

    /**
     * Name of the team for which this card is being displayed.
     */
    teamName: string;

    /**
     * Colour, in a CSS-compatible format, representing the team's theme.
     */
    teamColour: string;

    /**
     * Number of volunteers in the team, and the target number of volunteers they're striving for.
     */
    teamTargetSize: number;
    teamSize: number;

    /**
     * Settings regarding availability of actions based on the team's configuration.
     */
    enableApplications: boolean;
    enableRegistration: boolean;
    enableSchedule: boolean;
}

/**
 * The <EventTeamCard> component displays information associated with a particular team, giving a
 * birdseye view on how the team is doing, and what the team settings for this events are.
 */
export function EventTeamCard(props: EventTeamCardProps) {
    const [ teamHistoryOpen, setTeamHistoryOpen ] = useState<boolean>(false);

    const closeTeamHistory = useCallback(() => setTeamHistoryOpen(false), [ /* no deps */ ]);
    const openTeamHistory = useCallback(() => setTeamHistoryOpen(true), [ /* no deps */ ]);

    return (
        <Paper sx={{ aspectRatio: 1.25 }}>
            <Stack direction="column" spacing={2} justifyContent="space-between"
                   sx={{ height: '100%' }}>
                <TeamIdentityHeader backgroundColor={props.teamColour} sx={{ px: 2, py: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="h5">
                            {props.teamName}
                        </Typography>
                        <Tooltip title="Team history">
                            <IconButton size="small" color="inherit" onClick={openTeamHistory}>
                                <HistoryIcon fontSize="small" color="inherit" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </TeamIdentityHeader>
                <Stack direction="column" spacing={2} alignItems="center">
                    <Stack direction="column">
                        <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="# of volunteers">
                                <Typography variant="h5">
                                    {props.teamSize}
                                </Typography>
                            </Tooltip>
                            { !!props.teamTargetSize &&
                                <>
                                    <Typography variant="h5" sx={{ color: 'text.disabled' }}>
                                        /
                                    </Typography>
                                    <Tooltip title="target # of volunteers"
                                             sx={{ color: 'text.disabled' }}>
                                        <Typography variant="h5">
                                            {props.teamTargetSize}
                                        </Typography>
                                    </Tooltip>
                                </> }
                        </Stack>
                        <Typography variant="button" align="center">
                            Volunteers
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} justifyContent="center">
                        { props.enableRegistration &&
                            <Tooltip title="Information has been published">
                                <InfoOutlinedIcon color="success" />
                            </Tooltip> }
                        { !props.enableRegistration &&
                            <Tooltip title="Information has not been published">
                                <InfoOutlinedIcon color="error" />
                            </Tooltip> }

                        { props.enableApplications &&
                            <Tooltip title="Applications are being accepted">
                                <PlayCircleOutlineIcon color="success" />
                            </Tooltip> }
                        { !props.enableApplications &&
                            <Tooltip title="Applications have been suspended">
                                <PauseCircleOutlineIcon color="error" />
                            </Tooltip> }

                        { props.enableSchedule &&
                            <Tooltip title="Schedules have been published">
                                <EventAvailableIcon color="success" />
                            </Tooltip> }
                        { !props.enableSchedule &&
                            <Tooltip title="Schedules have not been published">
                                <EventBusyIcon color="error" />
                            </Tooltip> }
                    </Stack>
                </Stack>
                <TeamIdentityFooter backgroundColor={props.teamColour} />
            </Stack>
            { !!teamHistoryOpen &&
                <Dialog open={teamHistoryOpen} onClose={closeTeamHistory} fullWidth maxWidth="md">
                    <DialogTitle>
                        {props.teamName} team history
                    </DialogTitle>
                    <DialogContent>
                        <em>This graph is momentarily unavailable.</em>
                        {props.graph}
                    </DialogContent>
                    <DialogActions sx={{ pt: 1, mr: 1, mb: 0 }}>
                        <Button onClick={closeTeamHistory} variant="text">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog> }
        </Paper>
    );
}
