// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PeopleIcon from '@mui/icons-material/People';

import type { CommunicationLanguage, RegistrationStatus } from '@lib/database/Types';
import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { CommunicationDialog } from '@app/admin/components/CommunicationDialog';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Type describing an individual team option available to the volunteer.
 */
interface TeamOption {
    /**
     * Unique ID of the team.
     */
    id: number;

    /**
     * Theme colour of the team.
     */
    colour: string;

    /**
     * Name of the team.
     */
    name: string;

    /**
     * URL-safe slug of the team.
     */
    slug: string;

    /**
     * Current status of the volunteer's participation in this team.
     */
    status?: RegistrationStatus | null;
}

/**
 * Props accepted by the <VolunteerChangeTeamQuickAction> component.
 */
interface VolunteerChangeTeamQuickActionProps {
    /**
     * Server Action through which the team change can be committed.
     */
    action: ServerAction<{ message?: string; subject?: string; team: string }>;

    /**
     * Unique ID of the team that the volunteer currently participates in.
     */
    currentTeamId: number;

    /**
     * Unique ID of the event for which the change is being made.
     */
    eventId: number;

    /**
     * The teams relevant for the current volunteer, including their current one.
     */
    teams: TeamOption[];

    /**
     * Information about the volunteer for whom this quick action is being displayed.
     */
    volunteer: {
        /**
         * User ID of the volunteer.
         */
        id: number;

        /**
         * First name of the volunteer.
         */
        firstName: string;

        /**
         * Language in which the communication should be written, when known.
         */
        language?: CommunicationLanguage;
    };
}

/**
 * Returns the secondary message to display for a team option, when applicable.
 */
function getTeamOptionSecondaryMessage(
    status: RegistrationStatus | null | undefined, firstName: string): string | undefined
{
    switch (status) {
        case 'Accepted':
            return `${firstName} participates in this team`;

        case 'Cancelled':
            return `${firstName} cancelled their participation in this team`;

        case 'Registered':
            return `${firstName} already applied to join this team`;

        case 'Rejected':
            return `${firstName} was rejected for this team`;

        default:
            return undefined;
    }
}

/**
 * The <VolunteerChangeTeamQuickAction> component allows event administrators to change the team
 * that a volunteer participates in during a particular event.
 */
export function VolunteerChangeTeamQuickAction(props: VolunteerChangeTeamQuickActionProps) {
    const { action, currentTeamId, eventId, teams, volunteer } = props;

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);
    const [ selectedTeam, setSelectedTeam ] = useState<TeamOption | undefined>();

    const handleDialogClose = useCallback(() => {
        setDialogOpen(false);
        setTimeout(() => setSelectedTeam(undefined), 300);
    }, []);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    const handleSubmit = useCallback(async (subject?: string, message?: string)
        : Promise<ServerActionResult> =>
    {
        if (!selectedTeam)
            return { success: false, error: 'No team has been selected.' };

        return await action({
            team: selectedTeam.slug,
            subject,
            message,
        });
    }, [ action, selectedTeam ]);

    return (
        <>
            <Button startIcon={ <PeopleAltOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleDialogOpen}>
                Change team
            </Button>
            <ResponsiveDialog
                open={dialogOpen && !selectedTeam}
                onClose={handleDialogClose}
                title="Change team"
                description={
                    <>
                        You can change the team that <strong>{volunteer.firstName}</strong>{' '}
                        participates in during this event to the following. Not all teams may be
                        available.
                    </>
                }>
                <List dense disablePadding>
                    { teams.map(team => (
                        <ListItemButton key={team.id} disabled={!!team.status}
                                        onClick={ () => setSelectedTeam(team) }>
                            <ListItemIcon>
                                <PeopleIcon htmlColor={team.colour} />
                            </ListItemIcon>
                            <ListItemText
                                primary={team.name}
                                secondary={getTeamOptionSecondaryMessage(
                                    team.status, volunteer.firstName)}
                                slotProps={{ primary: { variant: 'subtitle2' } }} />
                        </ListItemButton>
                    )) }
                </List>
            </ResponsiveDialog>
            { !!selectedTeam &&
                <CommunicationDialog
                    title={`Change ${volunteer.firstName}'s team`}
                    open={dialogOpen} onClose={handleDialogClose}
                    action={handleSubmit}
                    recipientId={volunteer.id}
                    language={volunteer.language}
                    promptId="team-change"
                    promptParams={{
                        eventId: eventId,
                        oldTeamId: currentTeamId,
                        newTeamId: selectedTeam.id,
                    }}>
                    Send an e-mail to {volunteer.firstName} about moving them to the{' '}
                    {selectedTeam.name}.
                </CommunicationDialog> }
        </>
    );
}
