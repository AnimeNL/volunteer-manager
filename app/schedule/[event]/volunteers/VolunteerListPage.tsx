// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import Link from '@app/LinkProxy';
import { useCallback, useContext, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';

import type { PublicSchedule } from '@app/api/event/schedule/PublicSchedule';
import { Avatar } from '@app/components/Avatar';
import { ErrorCard } from '../components/ErrorCard';
import { ScheduleContext } from '../ScheduleContext';
import { SetTitle } from '../components/SetTitle';
import { formatDate } from '@lib/Temporal';
import { toZonedDateTime } from '../CurrentTime';

import { kEnforceSingleLine } from '../Constants';

/**
 * Information that should be known about an individual volunteer.
 */
type VolunteerInfo = PublicSchedule['volunteers'][number] & {
    /**
     * Name of the active shift they are engaged in, if any.
     */
    activeShiftName?: string;
}

/**
 * Props accepted by the <VolunteerList> component.
 */
interface VolunteerListProps {
    /**
     * The volunteers who are part of this team.
     */
    volunteers: VolunteerInfo[];
}

/**
 * The <VolunteerList> component displays a list of volunteers, each part of a particular team.
 */
function VolunteerList(props: VolunteerListProps) {
    const { volunteers } = props;

    return (
        <List disablePadding>
            {volunteers.map(volunteer => {
                const href = `./volunteers/${volunteer.id}`;

                // TODO: Display their badge as part of their avatar

                let isBackup: boolean = false;

                let secondary: React.ReactNode = volunteer.role;
                if (!!volunteer.roleLeader)
                    secondary = <strong>{volunteer.role}</strong>;

                let sx: SxProps<Theme> | undefined;
                if (!!volunteer.unavailableUntil) {
                    sx = {
                        backgroundColor: 'animecon.pastBackground',
                        '&:hover': {
                            backgroundColor: 'animecon.pastBackgroundHover',
                        }
                    };

                    if (volunteer.unavailableUntil === /* never= */ -1) {
                        secondary = <>{secondary} — unavailable</>;
                    } else {
                        secondary = (
                            <>
                                {secondary} — unavailable until{' '}
                                { formatDate(toZonedDateTime(volunteer.unavailableUntil), 'HH:mm') }
                            </>
                        );
                    }
                } else if (!!volunteer.activeShiftName) {
                    isBackup = volunteer.activeShiftName.startsWith('Backup');
                    secondary = <>{secondary} — {volunteer.activeShiftName}</>;
                    sx = {
                        backgroundColor: 'animecon.activeBackground',
                        '&:hover': {
                            backgroundColor: 'animecon.activeBackgroundHover',
                        }
                    };
                }

                return (
                    <ListItemButton LinkComponent={Link} key={volunteer.id} href={href} sx={sx}>
                        <ListItemAvatar>
                            <Avatar src={volunteer.avatar}>
                                {volunteer.name}
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={volunteer.name}
                                      primaryTypographyProps={{ variant: 'subtitle2' }}
                                      secondary={secondary}
                                      secondaryTypographyProps={{ sx: kEnforceSingleLine }} />
                        { isBackup &&
                            <Tooltip title="This volunteer may be available to help">
                                <HourglassBottomOutlinedIcon fontSize="small" color="primary" />
                            </Tooltip> }
                    </ListItemButton>
                );
            } )}
        </List>
    );
}

/**
 * The <VolunteerListPage> page displays a list of all volunteers that have been made available to
 * the signed in volunteer. Tabs will be used when they exist across more than a single team.
 */
export function VolunteerListPage() {
    const { schedule } = useContext(ScheduleContext);
    const router = useRouter();

    const teams = useMemo(() => {
        if (!schedule?.teams || !schedule.volunteers)
            return undefined;

        const teams = new Map<string, VolunteerInfo[]>(
            Object.values(schedule.teams).map(team => ([ team.id, [ /* volunteers */ ] ])));

        for (const volunteer of Object.values(schedule.volunteers)) {
            let activeShiftName: string | undefined;
            if (!!volunteer.activeShift)
                activeShiftName = schedule.shifts[volunteer.activeShift].name;

            teams.get(volunteer.team)?.push({
                ...volunteer,
                activeShiftName,
            });
        }

        for (const volunteers of teams.values()) {
            volunteers.sort((lhs, rhs) => {
                if (!!lhs.unavailableUntil !== !!rhs.unavailableUntil)
                    return !!lhs.unavailableUntil ? 1 : -1;  // unavailable volunteers come last

                return lhs.name.localeCompare(rhs.name);
            });
        }

        // Amend the `teams` with information about the team it's representing.
        const unsortedTeams = [ ...teams.entries() ].map(([ teamId, volunteers ]) => ({
            id: teamId,
            label: schedule.teams[teamId].name,
            volunteers,
        }));

        // Sort the teams by their name. This means that the volunteers page always has a
        // predictable list of teams shown.
        return unsortedTeams.sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

    }, [ schedule ]);

    // ---------------------------------------------------------------------------------------------

    let defaultTeam: string | undefined;
    if (!!schedule?.userId && schedule.volunteers.hasOwnProperty(schedule.userId))
        defaultTeam = schedule.volunteers[schedule.userId].team;
    else if (!!teams?.length)
        defaultTeam = teams[0].id;

    const searchParams = useSearchParams();
    const selectedTeam = searchParams.get('team') || defaultTeam;

    const handleTeamChange = useCallback((event: unknown, team: any) => {
        router.push(`./volunteers?team=${team}`);
    }, [ router ]);

    // ---------------------------------------------------------------------------------------------

    if (!teams || !teams.length) {
        return (
            <>
                <SetTitle title="Volunteers" />
                <ErrorCard title="No volunteers could be found!">
                    No volunteers have been assigned to this event yet.
                </ErrorCard>
            </>
        );
    } else if (teams.length === 1) {
        return (
            <>
                <SetTitle title="Volunteers" />
                <Paper>
                    <VolunteerList volunteers={teams[0].volunteers} />
                </Paper>
            </>
        );
    } else {
        return (
            <>
                <SetTitle title="Volunteers" />
                <Paper sx={{
                    '&.MuiPaper-root': {
                        borderRadius: { xs: 0, md: 1 },
                        margin: { xs: '-16px -16px -8px -16px', md: 0 },
                    },
                }}>
                    <Tabs onChange={handleTeamChange} value={selectedTeam} variant="fullWidth">
                        { teams.map(team =>
                            <Tab key={team.id} value={team.id} label={team.label} /> )}
                    </Tabs>
                    { teams.map(team => {
                        if (team.id !== selectedTeam)
                            return undefined;

                        return <VolunteerList key={team.id} volunteers={team.volunteers} />;
                    } )}
                </Paper>
            </>
        );
    }
}
