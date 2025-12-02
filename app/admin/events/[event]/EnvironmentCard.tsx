// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Box, { type BoxProps } from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import PeopleIcon from '@mui/icons-material/People';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { RemoteGraphFnReturn } from './finance/graphs/RemoteGraphFn';
import { RemoteGraphDialog } from './finance/graphs/RemoteGraphDialog';

/**
 * Props accepted by the <EnvironmentHeader> component.
 */
interface EnvironmentHeaderProps extends BoxProps {
    /**
     * Color reflecting the team's identity.
     */
    color: string;
};

/**
 * The <EnvironmentHeader> component displays a box appropriately coloured in the primary team's
 * identity, with a font colour that provides an appropriate amount of context.
 */
const EnvironmentHeader = styled((props: EnvironmentHeaderProps) => {
    // biome-ignore lint/correctness/noUnusedVariables: strip internal prop
    const { color, ...boxProps } = props;
    return <Box {...boxProps} />;
})(({ color, theme }) => ({
    backgroundColor: color,
    color: theme.palette.getContrastText(color),
    borderRadius: theme.shape.borderRadius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
}));

/**
 * The <EnvironmentFooter> component displays a box similarly themed after the environment's primary
 * team's identity, but for usage at the bottom of another component.
 */
const EnvironmentFooter = styled(EnvironmentHeader)(({ theme }) => ({
    borderRadius: theme.shape.borderRadius,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginBottom: '-1px !important',
    height: '1rem',
}));

/**
 * Props accepted by the <EnvironmentCard> component.
 */
export interface EnvironmentCardProps {
    /**
     * Domain on which these teams have been hosted.
     */
    domain: string;

    /**
     * Server action through which the data associated with the remote graph can be obtained.
     */
    partialFetchDataFn: (teamIds: number[]) => Promise<RemoteGraphFnReturn>;

    /**
     * The teams that are part of this environment. It's assumed that the signed in user has access
     * to the information associated with those teams.
     */
    teams: {
        /**
         * Unique ID for this team.
         */
        id: number;

        /**
         * CSS color through which the team can be identified.
         */
        color: string;

        /**
         * Whether this team participate in volunteer manager growth charts.
         */
        flagGrowthCharts: boolean;

        /**
         * Whether this team is responsible for managing landing page content.
         */
        flagManagesContent: boolean;

        /**
         * Information about participation for this team.
         */
        participants: {
            /**
             * Current number of participants in the team.
             */
            current: number;

            /**
             * Maximum number of participants that they would consider.
             */
            maximum?: number;

            /**
             * Target number of participants that they're looking for.
             */
            target?: number;
        };

        /**
         * Title through which the team should be known.
         */
        title: string;

    }[];

    /**
     * Title of the environment.
     */
    title: string;
}

/**
 * Type identifying an individual team part of the <EnvironmentCard> props.
 */
type EnvironmentCardTeam = EnvironmentCardProps['teams'][number];

/**
 * The <EnvironmentCard> component displays progression for the teams associated with a particular
 * environment, each of which are assumed to be able to attract volunteers.
 */
export function EnvironmentCard(props: EnvironmentCardProps) {
    const [ selectedTeam, setSelectedTeam ] = useState<EnvironmentCardTeam | undefined>();

    const handleClose = useCallback(() => setSelectedTeam(undefined), [ /* no deps */ ]);

    return (
        <Paper elevation={1} sx={{ minHeight: '100%', height: '100%' }}>
            <Stack direction="column" justifyContent="space-between" sx={{ height: '100%' }}>
                <EnvironmentHeader color={props.teams[0].color} sx={{ px: 2, py: 1 }}>
                    <Typography noWrap>
                        {props.title}
                        <Typography component="span" sx={{ opacity: 0.6 }}>
                            {' '}&middot; {props.domain}
                        </Typography>
                    </Typography>
                </EnvironmentHeader>
                <List dense disablePadding sx={{ px: 2, my: 1 }}>
                    { props.teams.map(team =>
                        <ListItem key={team.id} disableGutters disablePadding>
                            <ListItemIcon sx={{ minWidth: '24px' }}>
                                <PeopleIcon fontSize="inherit" htmlColor={team.color} />
                            </ListItemIcon>
                            <ListItemText onClick={ () => setSelectedTeam(team) }>
                                <Typography variant="body2" component="span" sx={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline dotted',
                                    textDecorationColor: theme =>
                                        theme.palette.mode === 'dark'
                                            ? '#ffffff80'
                                            : '#00000050',
                                }}>
                                    {team.title}
                                </Typography>
                            </ListItemText>
                            <Typography variant="body2">
                                {team.participants.current}
                                { !!team.participants.target &&
                                    <Typography component="span" color="textDisabled"
                                                variant="inherit">
                                        {' '} / {team.participants.target}
                                    </Typography> }
                            </Typography>
                        </ListItem> )}
                </List>
                <EnvironmentFooter color={props.teams[0].color} />
            </Stack>
            { !!selectedTeam &&
                <RemoteGraphDialog
                    fetchDataFn={ props.partialFetchDataFn.bind(null, [ selectedTeam.id ]) }
                    onClose={handleClose}
                    title={selectedTeam.title} /> }
        </Paper>
    );
}
