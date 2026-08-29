// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import GroupIcon from '@mui/icons-material/Group';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { CachedEvent } from '@lib/cache';
import { DashboardCard } from '@app/admin/dashboard/DashboardCard';
import { DashboardCardTitle } from '@app/admin/dashboard/DashboardCardTitle';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';
import db, { tEventsTeams, tTeams, tUsersEvents } from '@lib/database';

/**
 * Props accepted by the <EventTeamsCard> component.
 */
interface EventTeamsCardProps {
    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;
}

/**
 * Event dashboard card that displays the team who participate in this event.
 */
export async function EventTeamsCard(props: EventTeamsCardProps) {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const dbInstance = db;
    const teams = await dbInstance.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEventsTeams.eventId))
                .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
                .and(usersEventsJoin.registrationStatus.equals('Accepted'))
        .where(tEventsTeams.eventId.equals(props.event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            id: tTeams.teamId,
            color: tTeams.teamColourLightTheme,
            name: tTeams.teamName,

            size: dbInstance.count(usersEventsJoin.userId),
            target: tEventsTeams.teamTargetSize,
        })
        .groupBy(tEventsTeams.teamId)
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    return (
        <DashboardCard>
            <DashboardCardTitle icon={ <GroupsOutlinedIcon /> }>
                Participating teams
            </DashboardCardTitle>
            <List dense disablePadding sx={{ mb: 1 }}>
                { teams.map(team =>
                    <ListItem key={team.id}>
                        <ListItemIcon>
                            <GroupIcon htmlColor={team.color} fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={team.name} />
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography variant="body2">
                                {team.size}{' '}
                                <Typography component="span" color="textDisabled" variant="inherit">
                                    / {team.target}
                                </Typography>
                            </Typography>
                            <IconButton size="small">
                                <Tooltip title="Ayy">
                                    <TooltipIconWrapper>
                                    <SsidChartIcon color="primary" fontSize="inherit" />
                                    </TooltipIconWrapper>
                                </Tooltip>
                            </IconButton>
                        </Stack>
                    </ListItem> ) }
            </List>
        </DashboardCard>
    );
}
