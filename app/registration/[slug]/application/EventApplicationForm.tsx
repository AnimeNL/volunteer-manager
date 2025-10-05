// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useState } from 'react';

import { CheckboxElement } from '@proxy/react-hook-form-mui';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import FaceIcon from '@mui/icons-material/Face';
import Grid from '@mui/material/Grid';
import MuiAvatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { RegistrationStatus } from '@lib/database/Types';
import type { User } from '@lib/auth/User';
import { ApplicationParticipationForm, ApplicationAvailabilityForm } from './ApplicationParticipation';
import { AuthenticationContext } from '../../AuthenticationContext';
import { Avatar } from '@components/Avatar';

/**
 * Manual styles that apply to the <EventApplicationForm> client component.
 */
export const kStyles: { [key: string]: SxProps<Theme> } = {
    availabilityWarning: {
        borderLeft: (theme) => `3px solid ${theme.palette.warning.main}`,
        marginLeft: 3.5,
        paddingLeft: 2,
    },
    identity: {
        paddingBottom: 2,
        '& > .MuiBox-root': {
            width: 'fit-content',
            cursor: 'pointer',
            borderRadius: 1,
            padding: 1,
            paddingRight: 2,
            transition: 'background-color 0.3s ease-in-out',
        },
    },
    identityKnown: {
        backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? theme.palette.primary.dark
                                          : theme.palette.primary.light,
        '&:hover': {
            backgroundColor: (theme) => theme.palette.primary.main,
        },
    },
    identityUnknown: {
        backgroundColor: theme => theme.palette.mode === 'dark' ? 'grey.600' : 'grey.300',
        '&:hover': {
            backgroundColor: theme => theme.palette.mode === 'dark' ? 'grey.500' : 'grey.200',
        },
    },
};

/**
 * Props accepted by the <EventApplicationForm> component.
 */
export interface EventApplicationFormProps {
    /**
     * Short name of the event which will be used to contextualise decisions.
     */
    eventShortName: string;

    /**
     * Applications made by the same `user` with partnering teams. Applications that were cancelled
     * will not be included in this, although rejected ones are.
     */
    partnerApplications: {
        /**
         * URL of the application page on which the visitor can find more information.
         */
        href: string;

        /**
         * Status of their their application with the partnering team.
         */
        status: RegistrationStatus;

        /**
         * Name of the partnering team (e.g. "Volunteering Crew").
         */
        team: string;

    }[];

    /**
     * URL to which successful registrations (& activations) should be forwarded.
     */
    redirectUrl: string;

    /**
     * The user who is currently signed in, if any. Applications can only be submitted when the
     * visitor has identified to their account, so some subtle nudging may be required.
     */
    user?: User;
}

/**
 * The <EventApplicationForm> component solicits the information required for a visitor to apply to
 * join one of our events, in a particular team. Validation will be done by a Server Action through
 * which the application will be accepted.
 */
export function EventApplicationForm(props: EventApplicationFormProps) {
    const { eventShortName, partnerApplications, user } = props;

    const authenticationContext = useContext(AuthenticationContext);

    const requestAuthenticationFlow = useCallback(() => {
        authenticationContext.requestAuthenticationFlow(props.redirectUrl);
    }, [ authenticationContext, props.redirectUrl ])

    const [ availabilityWarning, setAvailabilityWarning ] = useState<boolean>(false);

    const availabilityLabel = `Yes, I will be fully available during ${eventShortName}`;
    const creditsLabel = `Yes, I'd like to be included in the ${eventShortName} credit reel`;
    const socialsLabel = 'Yes, I would like to join the private Discord and WhatsApp groups';

    return (
        <>
            <Typography variant="h6">
                Personal information
            </Typography>

            <Stack direction="row" alignItems="center" spacing={2} sx={kStyles.identity}>
                { user &&
                    <Box sx={kStyles.identityKnown} onClick={requestAuthenticationFlow}>
                        <Stack alignItems="center" direction="row" spacing={2}>
                            <Avatar src={user.avatarUrl}>
                                {user.name}
                            </Avatar>
                            <Typography variant="h6">
                                {user.name}
                            </Typography>
                        </Stack>
                    </Box> }

                { !user &&
                    <Box sx={kStyles.identityUnknown} onClick={requestAuthenticationFlow}>
                        <Stack alignItems="center" direction="row" spacing={2}>
                            <MuiAvatar>
                                <FaceIcon />
                            </MuiAvatar>
                            <Typography>
                                Please sign in or create an account
                            </Typography>
                        </Stack>
                    </Box> }

                { partnerApplications.length > 0 &&
                    <Stack spacing={0.5}>
                        { partnerApplications.map((application, index) => {
                            const label = `${application.team} application`;
                            const link = application.href;

                            return (
                                <Stack direction="row" spacing={1} key={index}>
                                    <WarningAmberIcon color="primary" />
                                    <Typography>
                                        { application.status === 'Registered' &&
                                            <>
                                                Your <MuiLink href={link}>{label}</MuiLink> is
                                                still being considered
                                            </> }
                                        { application.status === 'Accepted' &&
                                            <>
                                                Your <MuiLink href={link}>{label}</MuiLink> has
                                                already been accepted
                                            </> }
                                    </Typography>
                                </Stack>
                            );
                        } )}
                    </Stack> }

            </Stack>

            <Typography variant="h6">
                Your participation
            </Typography>
            <Grid container spacing={2} sx={{ pt: 1 }}>
                <ApplicationParticipationForm />
                <ApplicationAvailabilityForm />
            </Grid>

            <Typography variant="h6" sx={{ pt: 2 }}>
                Just to check…
            </Typography>
            <Stack>
                <CheckboxElement name="availability" size="small" label={availabilityLabel}
                                 onChange={(e) => setAvailabilityWarning(!e.target.checked)} />

                <Collapse in={availabilityWarning}>
                    <Typography color="warning" sx={kStyles.availabilityWarning}>
                        Please indicate your availability in the preferences field.
                    </Typography>
                </Collapse>

                <CheckboxElement name="credits" size="small" label={creditsLabel} />
                <CheckboxElement name="socials" size="small" label={socialsLabel} />
            </Stack>
        </>
    );
}
