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
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';
import { formatDate } from '@lib/Temporal';

/**
 * Type definition for a bullet point of information associated with an application.
 */
interface ApplicationBulletPoint {
    icon: React.ReactNode;
    message: React.ReactNode;
}

interface ApplicationProps {
    /**
     * Basic information about the volunteer's application that will be shown in this interface.
     */
    application: {
        userId: number;
        avatar?: string;
        date?: string;
        history: number;
        name: string;
        firstName: string;
        age: number;
        fullyAvailable: boolean;
        preferences?: string;
        preferenceHours?: number;
        preferenceTimingStart?: number;
        preferenceTimingEnd?: number;
        claim?: {
            name: string;
            isCurrentUser: boolean;
        };
        language?: CommunicationLanguage;
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
    moveFn?: ServerAction<{ team: string }>;

    /**
     * Server Action to invoke when the volunteer should be rejected.
     */
    rejectFn?: (subject?: string, message?: string) => Promise<ServerActionResult>;
}

/**
 * The <Application> component represents an individual application that can be acted upon.
 */
export function Application(props: ApplicationProps) {
    const { application, eventId, teamId } = props;

    const information: ApplicationBulletPoint[] = [];

    // Participation history:
    if (application.history) {
        information.push({
            icon: <InfoIcon fontSize="small" color="info" />,
            message: (
                <>
                    {application.firstName} has volunteered{' '}
                    <strong>
                        {application.history === 1 ? 'once' : `${application.history} times`}
                    </strong> before.
                </>
            ),
        });
    } else {
        information.push({
            icon: <InfoIcon fontSize="small" color="info" />,
            message: `${application.firstName} has not helped out at AnimeCon before.`,
        });
    }

    // Timing preferences:
    if (application.preferenceHours !== undefined &&
        application.preferenceTimingStart !== undefined &&
        application.preferenceTimingEnd !== undefined)
    {
        const start = String(application.preferenceTimingStart).padStart(2, '0');
        const end = String(application.preferenceTimingEnd).padStart(2, '0');
        information.push({
            icon: <InfoIcon fontSize="small" color="info" />,
            message: (
                <>
                    They're happy to volunteer for up to <strong>{application.preferenceHours}{' '}
                    hours</strong>, preferably between <strong>{start}:00</strong> –
                    <strong>{end}:00</strong>.
                </>
            ),
        });
    }

    // Participation preferences:
    if (application.preferences) {
        information.push({
            icon: <InfoIcon fontSize="small" color="info" />,
            message:
                <>
                    They shared some preferences:
                    "<strong><em>{application.preferences}</em></strong>"
                </>,
        });
    }

    // Availability:
    information.push({
        icon: application.fullyAvailable ? <CheckCircleIcon fontSize="small" color="success" />
                                         : <HelpOutlinedIcon fontSize="small" color="warning" />,
        message: (
            <>
                They indicated that they{' '}
                <strong>{application.fullyAvailable ? 'will be' : 'will not be'}</strong>{' '}
                fully available.
            </>
        ),
    });

    // Age:
    information.push({
        icon: application.age >= 18 ? <CheckCircleIcon fontSize="small" color="success" />
                                    : <HelpOutlinedIcon fontSize="small" color="warning" />,
        message: <>{application.firstName} will be {application.age} years old during the event.</>,
    });

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
            <Paper sx={{ display: 'flex', minHeight: '100%' }}>
                <Stack direction="column">
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
                                <ListItem key={index} sx={{ px: 1.2 }}>
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
                                    <Chip color="warning"
                                          label={`Claimed by ${application.claim.name}`}
                                          size="small" sx={{ ml: 1, mr: 'auto' }} /> }

                                { !!application.suspended &&
                                    <AccountRestrictedChip name={application.firstName}
                                                           reason={application.suspended}
                                                           sx={{ ml: 1, mr: 'auto' }} /> }

                                { !!props.rejectFn &&
                                    <Button size="small" color="error"
                                            startIcon={ <ThumbDownIcon /> }
                                            disabled={claimedByAnotherPerson}
                                            onClick={handleRejectOpen}>
                                        Reject
                                    </Button> }
                                { !!props.approveFn &&
                                    <Button size="small" color="success"
                                            startIcon={ <ThumbUpIcon /> }
                                            disabled={
                                                !!application.suspended || claimedByAnotherPerson }
                                            onClick={handleApproveOpen}>
                                        Approve
                                    </Button> }
                            </CardActions>
                        </> }
                </Stack>
            </Paper>

            { (!!claimEverOpen && !!props.claimFn) &&
                <ResponsiveFormDialog action={props.claimFn}
                                      open={claimOpen} onClose={handleCloseClaim}
                                      title={`Claim ${application.firstName}'s application`}
                                      submitLabel={ !application.claim ? 'Claim' : 'Release' }>
                    <Typography variant="body2">
                        { !application.claim &&
                            <>
                                You're about to claim <strong>{application.firstName}</strong>'s
                                application, which helps signals to others that you're working on
                                it. They will not be informed of this.
                            </> }
                        { !!application.claim &&
                            <>
                                You're about to release the claim on{' '}
                                <strong>{application.firstName}</strong>'s application, opening it
                                up for anyone to decide. They will not be informed of this.
                            </> }
                    </Typography>
                </ResponsiveFormDialog> }

            { (!!moveEverOpen && !!props.moveFn) &&
                <ResponsiveFormDialog action={props.moveFn}
                                      open={moveOpen} onClose={handleCloseMove}
                                      title={`Move ${application.firstName}'s application`}
                                      submitLabel="Move">

                    <Typography variant="body2">
                        Ask another team to consider <strong>{application.firstName}</strong>'s
                        application.
                    </Typography>

                    <SelectElement name="team" label="Team" options={props.availableTeams}
                                   size="small" fullWidth />

                </ResponsiveFormDialog> }

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
