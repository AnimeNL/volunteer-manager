// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useContext, useState } from 'react';

import { SelectElement } from '@components/proxy/react-hook-form-mui';

import Button from '@mui/material/Button';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import IconButton from '@mui/material/IconButton';
import InfoIcon from '@mui/icons-material/Info';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';
import Paper from '@mui/material/Paper';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import Stack from '@mui/material/Stack';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import Tooltip from '@mui/material/Tooltip';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import Typography from '@mui/material/Typography';

import type { CommunicationLanguage } from '@lib/database/Types';
import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { AccountRestrictedChip } from '@app/admin/organisation/accounts/[id]/AccountRestrictedChip';
import { AdminClientContext } from '@app/admin/AdminClientContext';
import { Avatar } from '@components/Avatar';
import { CommunicationDialog } from '@app/admin/components/CommunicationDialog';
import { ServerActionDialog } from '@app/admin/components/ServerActionDialog';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Type definition for a bullet point of information associated with an application.
 */
interface ApplicationBulletPoint {
    /**
     * Icon that should signify what the information is about.
     */
    icon: React.ReactNode;

    /**
     * Information to display on the bullet point.
     */
    message: React.ReactNode;
}

/**
 * Function that composes a bullet point on the volunteer's age during the event.
 */
function composeAgeBulletPoint(application: ApplicationProps['application']) {
    return {
        icon: application.age >= 18 ? <CheckCircleIcon fontSize="small" color="success" />
                                    : <HelpOutlinedIcon fontSize="small" color="warning" />,
        message:
            <>
                {application.firstName} will be {application.age} years old during the event.
            </>
    };
}

/**
 * Function that composes a bullet point on the volunteer's intended availability.
 */
function composeAvailabilityBulletPoint(application: ApplicationProps['application']) {
    return {
        icon: application.fullyAvailable ? <CheckCircleIcon fontSize="small" color="success" />
                                         : <HelpOutlinedIcon fontSize="small" color="warning" />,
        message:
            <>
                They indicated that they
                <strong> {application.fullyAvailable ? 'will be' : 'will not be'} </strong>
                fully available.
            </>
    };
}

/**
 * Function that composes a bullet point on the volunteer's past participation.
 */
function composeParticipationHistoryBulletPoint(application: ApplicationProps['application']) {
    if (!application.history) {
        return {
            icon: <InfoIcon fontSize="small" color="info" />,
            message: `${application.firstName} has not helped out at AnimeCon before.`,
        };
    }

    return {
        icon: <InfoIcon fontSize="small" color="info" />,
        message:
            <>
                {application.firstName} has volunteered
                <strong>{ application.history === 1 ? ' once' :
                    ` ${application.history} times`}</strong> before.
            </>
    };
}

/**
 * Function that composes a bullet point on the volunteer's participation preferences.
 */
function composePreferencesBulletPoint(application: ApplicationProps['application']) {
    if (!application.preferences)
        return undefined;

    return {
        icon: <InfoIcon fontSize="small" color="info" />,
        message:
            <>
                They shared some preferences: "<strong><em>{application.preferences}</em></strong>"
            </>
    };
}

/**
 * Function that composes a bullet point on the volunteer's participation timing preferences.
 */
function composeTimingPreferenceBulletPoint(application: ApplicationProps['application']) {
    return {
        icon: <InfoIcon fontSize="small" color="info" />,
        message:
            <>
                They're happy to volunteer for up to <strong>{application.preferenceHours} hours
                </strong>, preferrably between the hours of
                <strong> {`0${application.preferenceTimingStart}`.substr(-2)}:00
                </strong> – <strong>
                    {`0${application.preferenceTimingEnd}`.substr(-2)}:00</strong>.
            </>
    };
}

/**
 * Props accepted by the <Application> component.
 */
interface ApplicationProps {
    /**
     * Basic information about the volunteer's application that will be shown in this interface.
     */
    application: {
        /**
         * Unique ID of the user for whom this card is being displayed.
         */
        userId: number;

        /**
         * URL to the volunteer's avatar, when known.
         */
        avatar?: string;

        /**
         * Date at which the application was received, in a Temporal-compatible serialisation.
         */
        date?: string;

        /**
         * Number of events that the volunteer has helped out with before.
         */
        history: number;

        /**
         * Name of the volunteer, as they would like to be known by.
         */
        name: string;

        /**
         * First name of the volunteer, for use where more concise display is preferred.
         */
        firstName: string;

        /**
         * Age of the volunteer during the time where the event happens.
         */
        age: number;

        /**
         * Whether the volunteer has indicated to be fully available during the event.
         */
        fullyAvailable: boolean;

        /**
         * Participation preferences that the volunteer has indicated.
         */
        preferences?: string;

        /**
         * Intended number of hours that the volunteer would prefer to help out with.
         */
        preferenceHours?: number;

        /**
         * When known, preferred timing of the volunteer's activities.
         */
        preferenceTimingStart?: number;
        preferenceTimingEnd?: number;

        /**
         * Information about the owner of this application, i.e. the user who has claimed it.
         */
        claim?: {
            name: string;
            isCurrentUser: boolean;
        };

        /**
         * Language in which the communication should be written, when known.
         */
        language?: CommunicationLanguage;
        /**
         * Reason that this applicant's account has been suspended, if any.
         */
        suspended?: string;
    };

    /**
     * Teams that are available for moving this volunteer's application to.
     */
    availableTeams: { id: string; label: string }[];

    /**
     * Unique ID of the event for which this application is being shown.
     */
    eventId: number;

    /**
     * Unique ID of the team for which this application is being shown.
     */
    teamId: number;

    /**
     * Server Action to invoke when the volunteer should be approved.
     */
    approveFn?: (subject?: string, message?: string) => Promise<ServerActionResult>;

    /**
     * Server Action to claim an application as their own.
     */
    claimFn?: ServerAction;

    /**
     * Server Action to invoke when the volunteer should be moved to another team.
     */
    moveFn?: ServerAction;

    /**
     * Server Action to invoke when the volunteer should be rejected.
     */
    rejectFn?: (subject?: string, message?: string) => Promise<ServerActionResult>;
}

/**
 * The <Application> component represents an individual application that can be acted upon, either
 * by finding out more information about the applicant, by approving or rejecting it, or by moving
 * it to be another team's problem.
 */
export function Application(props: ApplicationProps) {
    const { application, eventId, teamId } = props;

    const information: ApplicationBulletPoint[] = [
        composeParticipationHistoryBulletPoint(application),
        composeTimingPreferenceBulletPoint(application),
        composePreferencesBulletPoint(application),
        composeAvailabilityBulletPoint(application),
        composeAgeBulletPoint(application),

    ].filter(Boolean) as ApplicationBulletPoint[];

    // ---------------------------------------------------------------------------------------------

    const { canAccessAccounts } = useContext(AdminClientContext);

    const [ claimEverOpen, setClaimEverOpen ] = useState<boolean>(false);
    const [ claimOpen, setClaimOpen ] = useState<boolean>(false);

    const [ moveEverOpen, setMoveEverOpen ] = useState<boolean>(false);
    const [ moveOpen, setMoveOpen ] = useState<boolean>(false);

    let accountAction: React.ReactNode;
    if (canAccessAccounts) {
        const href = `/admin/organisation/accounts/${application.userId}`;

        accountAction = (
            <IconButton component={Link} href={href} sx={{ mt: 1.5, mr: 1 }}>
                <Tooltip title="Account information">
                    <PersonSearchIcon fontSize="small" />
                </Tooltip>
            </IconButton>
        );
    }

    const handleCloseClaim = useCallback(() => setClaimOpen(false), [ /* no dependencies */ ]);
    const handleOpenClaim = useCallback(() => {
        setClaimEverOpen(true);
        setClaimOpen(true);
    }, [ /* no dependencies */ ]);

    let claimAction: React.ReactNode;
    if (!!props.claimFn) {
        claimAction = (
            <IconButton onClick={handleOpenClaim} sx={{ mt: 1.5, mr: 1 }}>
                { !!application.claim &&
                    <Tooltip title="Release the claim">
                        <LockOpenOutlinedIcon color="warning" fontSize="small" />
                    </Tooltip> }
                { !application.claim &&
                    <Tooltip title="Claim this application">
                        <LockPersonOutlinedIcon fontSize="small" />
                    </Tooltip> }
            </IconButton>
        );
    }

    const claimedByAnotherPerson =
        !!application.claim && !application.claim.isCurrentUser;

    const handleCloseMove = useCallback(() => setMoveOpen(false), [ /* no dependencies */ ]);
    const handleOpenMove = useCallback(() => {
        setMoveEverOpen(true);
        setMoveOpen(true);
    }, [ /* no dependencies */ ]);

    let moveAction: React.ReactNode;
    if (!!props.moveFn && props.availableTeams.length > 0) {
        moveAction = (
            <IconButton onClick={handleOpenMove} sx={{ mt: 1.5, mr: 1 }}>
                <Tooltip title="Move application">
                    <TransferWithinAStationIcon fontSize="small" />
                </Tooltip>
            </IconButton>
        );
    }

    let actions: React.ReactNode;
    if (!!accountAction || !!claimAction || !!moveAction) {
        actions = (
            <Stack direction="row">
                {moveAction}
                {claimAction}
                {accountAction}
            </Stack>
        );
    } else if (!!accountAction || !!moveAction) {
        actions = accountAction || moveAction;
    }

    // ---------------------------------------------------------------------------------------------

    const [ approveEverOpen, setApproveEverOpen ] = useState<boolean>(false);
    const [ approveOpen, setApproveOpen ] = useState<boolean>(false);
    const [ rejectEverOpen, setRejectEverOpen ] = useState<boolean>(false);
    const [ rejectOpen, setRejectOpen ] = useState<boolean>(false);

    const handleApproveClose = useCallback(() => setApproveOpen(false), [ /* no dependencies */ ]);
    const handleApproveOpen = useCallback(() => {
        setApproveEverOpen(true);
        setApproveOpen(true);
    }, [ /* no dependencies */ ]);

    const handleRejectClose = useCallback(() => setRejectOpen(false), [ /* no dependencies */ ]);
    const handleRejectOpen = useCallback(() => {
        setRejectEverOpen(true);
        setRejectOpen(true);
    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    const avatarUrl = application.avatar ? `/blob/${application.avatar}.png` : undefined;
    const applicationDate =
            Temporal.ZonedDateTime.from(application.date!).withTimeZone(Temporal.Now.timeZoneId());

    return (
        <>
            <Stack component={Paper} direction="column" sx={{ minHeight: '100%' }}>
                <CardHeader action={actions}
                            avatar={
                                <Avatar src={avatarUrl}>
                                    {application.name}
                                </Avatar>
                            }
                            title={application.name}
                            subheader={ formatDate(applicationDate, 'dddd, MMMM D, YYYY') }
                            slotProps={{ title: { variant: 'subtitle1' } }} />
                <Divider />
                <CardContent sx={{ flex: 1, py: '0 !important' }}>
                    <List dense>
                        { information.map(({ icon, message }, index) =>
                            <ListItem key={index}>
                                <ListItemIcon>
                                    {icon}
                                </ListItemIcon>
                                <ListItemText primary={message} />
                            </ListItem> )}
                    </List>
                </CardContent>
                { (!!props.rejectFn || !!props.approveFn) &&
                    <>
                        <Divider />
                        <CardActions disableSpacing sx={{ justifyContent: 'flex-end', gap: 2 }}>
                            { !!application.claim &&
                                <Chip color="warning" label={`Claimed by ${application.claim.name}`}
                                      size="small" sx={{ ml: 1, mr: 'auto' }} /> }

                            { !!application.suspended &&
                                <AccountRestrictedChip name={application.firstName}
                                                       reason={application.suspended}
                                                       sx={{ ml: 1, mr: 'auto' }} /> }

                            { !!props.rejectFn &&
                                <Button size="small" color="error" startIcon={ <ThumbDownIcon /> }
                                        disabled={claimedByAnotherPerson}
                                        onClick={handleRejectOpen}>
                                    Reject
                                </Button> }
                            { !!props.approveFn &&
                                <Button size="small" color="success" startIcon={ <ThumbUpIcon /> }
                                        disabled={!!application.suspended || claimedByAnotherPerson}
                                        onClick={handleApproveOpen}>
                                    Approve
                                </Button> }
                        </CardActions>
                    </> }
            </Stack>

            { (!!claimEverOpen && !!props.claimFn) &&
                <ServerActionDialog action={props.claimFn} open={claimOpen}
                                    onClose={handleCloseClaim}
                                    title={`Claim ${application.firstName}'s application`}
                                    submitLabel={ !application.claim ? 'Claim' : 'Release' }>
                    <Typography sx={{ mb: 2 }}>
                        { !application.claim &&
                            <>
                                You're about to claim <strong>{application.name}</strong>'s
                                application, which helps signals to others that you're working on
                                it. They will not be informed of this.
                            </> }
                        { !!application.claim &&
                            <>
                                You're about to release the claim on{' '}
                                <strong>{application.name}</strong>'s application, opening it up for
                                anyone to decide. They will not be informed of this.
                            </> }
                    </Typography>
                </ServerActionDialog> }

            { (!!moveEverOpen && !!props.moveFn) &&
                <ServerActionDialog action={props.moveFn} open={moveOpen} onClose={handleCloseMove}
                                    title={`Move ${application.firstName}'s application`}
                                    submitLabel="Move">
                    <Typography sx={{ mb: 2 }}>
                        You're about to move <strong>{application.firstName}</strong>'s application
                        to be considered by another team. They will not be informed of this.
                    </Typography>
                    <SelectElement name="team" label="Destination" options={props.availableTeams}
                                   size="small" fullWidth />
                </ServerActionDialog> }

            { (!!approveEverOpen && !!props.approveFn) &&
                <CommunicationDialog title={`Approve ${application.firstName}'s application`}
                                     open={approveOpen} onClose={handleApproveClose}
                                     recipientId={application.userId}
                                     language={application.language}
                                     action={props.approveFn}
                                     promptId="application-approved"
                                     promptParams={{ eventId, teamId }}>
                    Send an e-mail to <strong>{application.firstName}</strong> about approving their
                    application to help out.
                </CommunicationDialog> }

            { (!!rejectEverOpen && !!props.rejectFn) &&
                <CommunicationDialog title={`Reject ${application.firstName}'s application`}
                                     open={rejectOpen} onClose={handleRejectClose}
                                     recipientId={application.userId}
                                     language={application.language}
                                     action={props.rejectFn}
                                     promptId="application-rejected"
                                     promptParams={{ eventId, teamId }}>
                    Send an e-mail to <strong>{application.firstName}</strong> about rejecting their
                    application to help out.
                </CommunicationDialog> }
        </>
    );
}
