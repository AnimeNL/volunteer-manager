// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PeopleIcon from '@mui/icons-material/People';
import Typography from '@mui/material/Typography';

import type { CommunicationLanguage, RegistrationStatus } from '@lib/database/Types';
import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { CommunicationDialog } from '@app/admin/components/CommunicationDialog';

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

    // ---------------------------------------------------------------------------------------------

    if (selectedTeam) {
        return (
            <CommunicationDialog title={`Change ${volunteer.firstName}'s team`}
                                 open={dialogOpen}
                                 onClose={handleDialogClose}
                                 recipientId={volunteer.id}
                                 language={volunteer.language}
                                 promptId="team-change"
                                 promptParams={{
                                     eventId: eventId,
                                     oldTeamId: currentTeamId,
                                     newTeamId: selectedTeam.id,
                                 }}
                                 action={handleSubmit}>
                Send an e-mail to <strong>{volunteer.firstName}</strong> about moving them to the
                <strong> {selectedTeam.name}</strong>.
            </CommunicationDialog>
        );
    }

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Button startIcon={ <PeopleAltOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleDialogOpen}>
                Change team
            </Button>
            <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth>
                <DialogTitle>
                    Change team
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        You can change the team that <strong>{volunteer.firstName}</strong> participates
                        in during this event to the following. Not all teams may be available.
                    </Typography>
                    <List dense>
                        { teams.map((team, index) => {
                            let secondary: string | undefined = undefined;
                            switch (team.status) {
                                case 'Accepted':
                                    secondary =
                                        `${volunteer.firstName} is currently part of this team`;
                                    break;

                                case 'Cancelled':
                                    secondary =
                                        `${volunteer.firstName} cancelled their participation ` +
                                        'in this team, and can be reinstated';
                                    break;

                                case 'Registered':
                                    secondary =
                                        `${volunteer.firstName} already applied to join this ` +
                                        'team, which can be approved';
                                    break;

                                case 'Rejected':
                                    secondary =
                                        `${volunteer.firstName} was rejected for this team, ` +
                                        'which can be reconsidered';
                                    break;

                                default:
                                    // No secondary message necessary - they can join this team.
                                    break;
                            }

                            const disabled = !!team.status;

                            return (
                                <ListItemButton key={index} disabled={disabled}
                                                onClick={ () => setSelectedTeam(team) }>
                                    <ListItemIcon>
                                        <PeopleIcon htmlColor={team.colour} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={team.name} secondary={secondary}
                                        slotProps={{ primary: { variant: 'subtitle2' } }} />
                                </ListItemButton>
                            );
                        }) }
                    </List>
                </DialogContent>
            </Dialog>
        </>
    );
}
