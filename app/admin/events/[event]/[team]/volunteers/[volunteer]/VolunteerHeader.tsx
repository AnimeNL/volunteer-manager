// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, SelectElement } from '@proxy/react-hook-form-mui';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LoadingButton from '@mui/lab/LoadingButton';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import Paper from '@mui/material/Paper';
import PeopleIcon from '@mui/icons-material/People';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { PageInfoWithTeam } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import type { User } from '@lib/auth/User';
import type { VolunteerRolesDefinition } from '@app/api/admin/volunteerRoles';
import type { VolunteerTeamsDefinition } from '@app/api/admin/volunteerTeams';
import { CommunicationDialog } from '@app/admin/components/CommunicationDialog';
import { ContrastBox } from '@app/admin/components/ContrastBox';
import { Privilege, can } from '@lib/auth/Privileges';
import { RegistrationStatus } from '@lib/database/Types';
import { SettingDialog } from '@app/admin/components/SettingDialog';
import { callApi } from '@lib/callApi';

type TeamsForVolunteer = VolunteerTeamsDefinition['response']['teams'];

/**
 * Props accepted by the <ChangeRoleDialog> dialog.
 */
interface ChangeRoleDialogProps {
    /**
     * Callback function that should be called when the dialog is being closed.
     */
    onClose: (refresh?: boolean) => void;

    /**
     * ID of the event for which the role might be changed.
     */
    eventId: number;

    /**
     * Whether the dialog is currently open.
     */
    open?: boolean;

    /**
     * The roles that are available for the current team.
     */
    roles: NonNullable<VolunteerRolesDefinition['response']['roles']>;

    /**
     * ID of the team for which the role might be changed.
     */
    teamId: number;

    /**
     * The volunteer for whom this dialog is being displayed.
     */
    volunteer: VolunteerHeaderProps['volunteer'];
}

/**
 * The <ChangeRoleDialog> dialog allows certain people to change the roles assigned to volunteers.
 * The list of available roles will be fetched on first load.
 */
function ChangeRoleDialog(props: ChangeRoleDialogProps) {
    const { eventId, onClose, open, roles, teamId, volunteer } = props;

    const options = useMemo(() => {
        return roles ? roles.map(role => ({ id: role.roleId, label: role.roleName })) : [];
    }, [ roles ]);

    const [ selectedRole, setSelectedRole ] = useState<number>(volunteer.roleId);
    const [ warning, setWarning ] = useState<boolean>(false);

    const handleChange = useCallback((value: any) => setSelectedRole(value), [ setSelectedRole ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        const response = await callApi('post', '/api/admin/volunteer-roles', {
            eventId,
            roleId: data.role,
            teamId,
            userId: volunteer.userId,
        });

        if (response.success)
            return { success: `${volunteer.firstName}'s role has been successfully updated.` };
        else
            return { error: `${volunteer.firstName}'s role could not be updated right now.` };

    }, [ eventId, teamId, volunteer ]);

    useEffect(() => {
        setSelectedRole(volunteer.roleId);
    }, [ open, setSelectedRole, volunteer ]);

    useEffect(() => {
        for (const { roleId, roleAdminAccess } of roles ?? []) {
            if (roleId !== selectedRole)
                continue;

            setWarning(roleAdminAccess);
            return;
        }
        setWarning(false);
    }, [ roles, selectedRole, setWarning ]);

    return (
        <SettingDialog defaultValues={{ role: volunteer.roleId }}
                       description={
                           <>
                               You can change the role that <strong>{volunteer.firstName} </strong>
                               has been assigned, defining what our expectations are for them
                               during the event.
                           </> }
                        onClose={onClose} onSubmit={handleSubmit} open={open}
                        title="Change role">

            <SelectElement name="role" label="Role" size="small" fullWidth
                           options={options} onChange={handleChange} sx={{ mt: 2 }} />

            <Collapse in={!!warning}>
                <Alert severity="warning" sx={{ mt: 2 }}>
                    This role will grant administration access to
                    <strong> {volunteer.firstName}</strong> for this event.
                </Alert>
            </Collapse>

        </SettingDialog>
    );
}

/**
 * Props accepted by the <ChangeTeamDialog> component.
 */
interface ChangeTeamDialogProps {
    /**
     * Whether the signed in volunteer is allowed to make silent changes to participation.
     */
    allowSilent?: boolean;

    /**
     * Unique slug of the team that the volunteer currently participates in.
     */
    currentTeam: string;

    /**
     * The unique slug of the event the change is being made for.
     */
    event: string;

    /**
     * Callback function that should be called when the dialog is being closed.
     */
    onClose: (refresh?: boolean) => void;

    /**
     * Whether the dialog is currently open.
     */
    open?: boolean;

    /**
     * The teams relevant for the current volunteer, including their current one.
     */
    teams: NonNullable<TeamsForVolunteer>;

    /**
     * The volunteer for whom this dialog is being displayed.
     */
    volunteer: VolunteerHeaderProps['volunteer'];
}

/**
 * The <ChangeTeamDialog> component allows event administrators to change the team of volunteers who
 * signed up to participate in a particular event. Team changes come with mandatory messages.
 */
function ChangeTeamDialog(props: ChangeTeamDialogProps) {
    const { allowSilent, event, onClose, open, volunteer } = props;
    const teams = props.teams ?? [];

    const router = useRouter();
    const [ selectedTeam, setSelectedTeam ] =
        useState<ChangeTeamDialogProps['teams'][number] | undefined>();

    // ---------------------------------------------------------------------------------------------

    const handleClose = useCallback(() => {
        onClose();
        setTimeout(() => {
            setSelectedTeam(undefined);
        }, 300);
    }, [ onClose ]);

    const handleSubmit = useCallback(async (subject?: string, message?: string) => {
        try {
            if (!selectedTeam)
                return { error: 'No team has been selected' };

            const response = await callApi('post', '/api/admin/volunteer-teams', {
                userId: volunteer.userId,
                event,

                update: {
                    currentTeam: props.currentTeam,
                    updatedTeam: selectedTeam.teamSlug,
                    subject, message,
                },
            });

            if (response.success) {
                const targetUrl =
                    `/admin/events/${event}/${selectedTeam.teamSlug}/volunteers/${volunteer.userId}`

                setTimeout(() => router.push(targetUrl), 1250);

                return {
                    success: `${volunteer.firstName} has been moved to the ${selectedTeam.teamName}`
                };
            } else {
                return { error: response.error ?? 'Something went wrong' };
            }
        } catch (error: any) {
            return { error: error.message };
        }
    }, [ event, props.currentTeam, router, selectedTeam, volunteer ]);

    // ---------------------------------------------------------------------------------------------

    if (selectedTeam) {
        return (
            <CommunicationDialog title={`Change ${volunteer.firstName}'s team`}
                                 open={props.open} onClose={handleClose}
                                 confirmLabel="Change team" allowSilent={allowSilent} description={
                                     <>
                                         You're about to change
                                         <strong> {volunteer.firstName}</strong>'s team to the
                                         <strong> {selectedTeam.teamName}</strong>.
                                     </>
                                 } apiParams={{
                                     type: 'change-team',
                                     changeTeam: {
                                         userId: volunteer.userId,
                                         event: props.event,
                                         currentTeam: props.currentTeam,
                                         updatedTeam: selectedTeam.teamSlug,
                                     },
                                 }} onSubmit={handleSubmit} />
        );
    }

    // ---------------------------------------------------------------------------------------------

    return (
        <Dialog open={!!open} onClose={handleClose} fullWidth>
            <DialogTitle>
                Change team
            </DialogTitle>
            <DialogContent>
                <Typography>
                    You can change the team that <strong>{volunteer.firstName}</strong> participates
                    in during this event to the following. Not all teams may be available.
                </Typography>
                <List dense>
                    { teams.map((team, index) => {
                        let secondary: string | undefined = undefined;
                        switch (team.status) {
                            case 'Accepted':
                                secondary = `${volunteer.firstName} is currently part of this team`;
                                break;

                            case 'Cancelled':
                                secondary = `${volunteer.firstName} cancelled their participation `
                                    + 'in this team, and can be reinstated';
                                break;

                            case 'Registered':
                                secondary = `${volunteer.firstName} already applied to join this `
                                    + 'team, which can be approved';
                                break;

                            case 'Rejected':
                                secondary = `${volunteer.firstName} was rejected for this team, `
                                    + 'which can be reconsidered';
                                break;

                            case 'Unregistered':
                                // No secondary message necessary - they can join this team.
                                break;
                        }

                        return (
                            <ListItemButton key={index} disabled={team.status !== 'Unregistered'}
                                            onClick={ () => setSelectedTeam(team) }>
                                <ListItemIcon>
                                    <PeopleIcon htmlColor={team.teamColour} />
                                </ListItemIcon>
                                <ListItemText primaryTypographyProps={{ variant: 'subtitle2' }}
                                              primary={team.teamName} secondary={secondary} />
                            </ListItemButton>
                        );
                    }) }
                </List>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Props accepted by the <VolunteerHeader> component.
 */
interface VolunteerHeaderProps {
    /**
     * Whether the signed in volunteer has the ability to update applications.
     */
    canUpdateApplications: boolean;

    /**
     * Information about the event this volunteer will participate in.
     */
    event: PageInfoWithTeam['event'];

    /**
     * Information about the team this volunteer is part of.
     */
    team: PageInfoWithTeam['team'];

    /**
     * Information about the volunteer for whom this page is being displayed.
     */
    volunteer: {
        /**
         * User ID of the volunteer who this page is representing.
         */
        userId: number;

        /**
         * The volunteer's first name.
         */
        firstName: string;

        /**
         * The volunteer's display name.
         */
        name: string;

        /**
         * ID of the role that is assigned to the volunteer.
         */
        roleId: number;

        /**
         * The status of the volunteer's registration in the current event.
         */
        registrationStatus: RegistrationStatus;
    };

    /**
     * The user who is signed in to their account. Used for access checks.
     */
    user: User;
}

/**
 * The <VolunteerHeader> component indicates which volunteer is being shown, and provides actions
 * to change their participation. The exact actions depend on the access level of the user.
 */
export function VolunteerHeader(props: VolunteerHeaderProps) {
    const { canUpdateApplications, event, team, volunteer, user } = props;

    const router = useRouter();
    const showOptions =
        can(user, Privilege.EventAdministrator) ||
        canUpdateApplications ||
        can(user, Privilege.VolunteerAdministrator);

    // ---------------------------------------------------------------------------------------------
    // Common (cancel & reinstate participation)
    // ---------------------------------------------------------------------------------------------

    const allowSilent = can(user, Privilege.VolunteerSilentMutations);

    const handleDecided = useCallback(
        async (status: RegistrationStatus, subject?: string, message?: string) => {
            const response = await callApi('put', '/api/application/:event/:team/:userId', {
                event: event.slug,
                team: team.slug,
                userId: volunteer.userId,
                status: {
                    registrationStatus: status,
                    subject, message,
                }
            });

            if (response.success) {
                router.refresh();
                return { success: 'Your decision has been processed, thanks!' };
            } else {
                return { error: 'Something went wrong when processing your decision. Try again?' };
            }
        }, [ event, router, team, volunteer ]);

    // ---------------------------------------------------------------------------------------------
    // Cancel participation
    // ---------------------------------------------------------------------------------------------

    const [ cancelOpen, setCancelOpen ] = useState<boolean>(false);

    const handleCancelClose = useCallback(() => setCancelOpen(false), [ /* no deps */ ]);
    const handleCancelOpen = useCallback(() => setCancelOpen(true), [ /* no deps */ ]);

    const handleCancelled = useCallback((subject?: string, message?: string) =>
        handleDecided(RegistrationStatus.Cancelled, subject, message), [ handleDecided ]);

    // ---------------------------------------------------------------------------------------------
    // Reinstate participation
    // ---------------------------------------------------------------------------------------------

    const [ reinstateOpen, setReinstateOpen ] = useState<boolean>(false);

    const handleReinstateClose = useCallback(() => setReinstateOpen(false), [ /* no deps */ ]);
    const handleReinstateOpen = useCallback(() => setReinstateOpen(true), [ /* no deps */ ]);

    const handleReinstated = useCallback((subject?: string, message?: string) =>
        handleDecided(RegistrationStatus.Accepted, subject, message), [ handleDecided ]);

    // ---------------------------------------------------------------------------------------------
    // Change role
    // ---------------------------------------------------------------------------------------------

    const [ roles, setRoles ] = useState<VolunteerRolesDefinition['response']['roles']>();
    const [ rolesLoading, setRolesLoading ] = useState<boolean>(false);
    const [ rolesOpen, setRolesOpen ] = useState<boolean>(false);

    const handleRolesClose = useCallback(() => setRolesOpen(false), [ setRolesOpen ]);
    const handleRolesOpen = useCallback(async () => {
        if (!roles) {
            setRolesLoading(true);
            try {
                const response = await callApi('post', '/api/admin/volunteer-roles', {
                    teamId: team.id,
                });

                setRoles(response.roles);
            } finally {
                setRolesLoading(false);
            }
        }
        setRolesOpen(true);
    }, [ roles, setRoles, setRolesLoading, setRolesOpen, team ]);

    // ---------------------------------------------------------------------------------------------
    // Change team
    // ---------------------------------------------------------------------------------------------

    const [ teamsForVolunteer, setTeamsForVolunteer ] = useState<TeamsForVolunteer>();
    const [ teamsLoading, setTeamsLoading ] = useState<boolean>(false);
    const [ teamsOpen, setTeamsOpen ] = useState<boolean>(false);

    const handleTeamsClose = useCallback(() => setTeamsOpen(false), [ setTeamsOpen ]);
    const handleTeamsOpen = useCallback(async () => {
        if (!teamsForVolunteer) {
            setTeamsLoading(true);
            try {
                const response = await callApi('post', '/api/admin/volunteer-teams', {
                    event: event.slug,
                    userId: volunteer.userId,
                });

                setTeamsForVolunteer(response.teams);
            } finally {
                setTeamsLoading(false);
            }
        }
        setTeamsOpen(true);
    }, [ event, teamsForVolunteer, volunteer ]);

    // ---------------------------------------------------------------------------------------------

    const navigateToAccount = useCallback(() => {
        router.push(`/admin/volunteers/${volunteer.userId}`)
    }, [ router, volunteer ] );

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5">
                {volunteer.name}
                <Typography component="span" variant="h5" color="action.active" sx={{ pl: 1 }}>
                    ({event.shortName} {team.name})
                </Typography>
            </Typography>
            <ContrastBox sx={{ mt: 1, px: 2, py: 1, display: showOptions ? 'block' : 'none' }}>
                <Stack divider={ <Divider orientation="vertical" flexItem /> }
                       direction="row" spacing={1}>

                    { can(user, Privilege.VolunteerAdministrator) &&
                        <Button onClick={navigateToAccount} startIcon={ <AccountCircleIcon /> }>
                            Account
                        </Button> }

                    { (canUpdateApplications &&
                           volunteer.registrationStatus === RegistrationStatus.Accepted) &&
                        <Button startIcon={ <DoNotDisturbIcon /> } onClick={handleCancelOpen}>
                            Cancel participation
                        </Button> }

                    { (canUpdateApplications &&
                           volunteer.registrationStatus === RegistrationStatus.Cancelled) &&
                        <Button startIcon={ <SettingsBackupRestoreIcon /> }
                                onClick={handleReinstateOpen}>
                            Reinstate volunteer
                        </Button> }

                    { can(user, Privilege.EventAdministrator) &&
                        <LoadingButton startIcon={ <ManageAccountsIcon /> }
                                       onClick={handleRolesOpen} loading={rolesLoading}>
                            Change role
                        </LoadingButton> }

                    { can(user, Privilege.EventAdministrator) &&
                        <LoadingButton startIcon={ <PeopleIcon /> }
                                       onClick={handleTeamsOpen} loading={teamsLoading}>
                            Change team
                        </LoadingButton> }

                </Stack>
            </ContrastBox>
            <CommunicationDialog title={`Cancel ${volunteer.firstName}'s participation`}
                                 open={cancelOpen} onClose={handleCancelClose}
                                 confirmLabel="Proceed" allowSilent={allowSilent} description={
                                     <>
                                         You're about to cancel
                                         <strong> {volunteer.firstName}</strong>'s participation in
                                         this event.
                                     </>
                                 } apiParams={{
                                     type: 'cancel-participation',
                                     cancelParticipation: {
                                         userId: volunteer.userId,
                                         event: event.slug,
                                         team: team.slug,
                                     }
                                 }} onSubmit={handleCancelled} />

            <CommunicationDialog title={`Reinstate ${volunteer.firstName}'s participation`}
                                 open={reinstateOpen} onClose={handleReinstateClose}
                                 confirmLabel="Reinstate" allowSilent={allowSilent} description={
                                     <>
                                         You're about to reinstate
                                         <strong> {volunteer.firstName}</strong> to participation in
                                         this event.
                                     </>
                                 } apiParams={{
                                     type: 'reinstate-participation',
                                     reinstateParticipation: {
                                         userId: volunteer.userId,
                                         event: event.slug,
                                         team: team.slug,
                                     }
                                 }} onSubmit={handleReinstated} />

            <ChangeRoleDialog onClose={handleRolesClose} open={roles && rolesOpen}
                              roles={roles!} volunteer={volunteer} eventId={event.id}
                              teamId={team.id} />

            <ChangeTeamDialog onClose={handleTeamsClose} open={teamsForVolunteer && teamsOpen}
                              teams={teamsForVolunteer!} allowSilent={allowSilent}
                              volunteer={volunteer} event={event.slug}
                              currentTeam={team.slug} />

        </Paper>
    );
}
