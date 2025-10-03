// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Paper from '@mui/material/Paper';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import Typography from '@mui/material/Typography';

import { darken, lighten } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { green, red, yellow } from '@mui/material/colors';

import type { EnvironmentContextApplication } from '@lib/EnvironmentContext';
import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Name of the state, stored in local storage, indicating whether the progress bar should be open.
 */
const kProgressExpansionStateName = 'vm-progress-expanded';

/**
 * CSS customizations applied to the <RegistrationProgress> component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    root: { position: 'relative' },

    containerAccepted: {
        '& svg': { color: theme => theme.palette.mode === 'light' ? green[900] : green[400] },
        backgroundColor:
            theme => theme.palette.mode === 'light' ? lighten(theme.palette.success.main, 0.75)
                                                    : darken(theme.palette.success.main, 0.6),
    },

    containerCancelledOrRejected: {
        '& svg': { color: theme => theme.palette.mode === 'light' ? red[800] : red[400] },
        backgroundColor:
            theme => theme.palette.mode === 'light' ? lighten(theme.palette.error.main, 0.8)
                                                    : darken(theme.palette.error.main, 0.7),
    },

    containerRegistered: {
        '& svg': { color: theme => theme.palette.mode === 'light' ? yellow[900] : yellow[300] },
        backgroundColor:
            theme => theme.palette.mode === 'light' ? lighten(theme.palette.warning.main, 0.87)
                                                    : darken(theme.palette.warning.main, 0.75),
    },

    divider: { marginBottom: 1 },

    summary: {
        minHeight: 'auto',

        '& .MuiAccordionSummary-content': {
            marginTop: 1,
            marginBottom: 0.8,
        },
    },

    summaryAccepted: {
        '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            justifyContent: 'space-between',
        },
    },

    summaryIcon: {
        lineHeight: 'normal',
        paddingRight: 1,
        paddingTop: '1px',
    },

    details: {
        paddingTop: 0,
        paddingRight: 2,
        paddingBottom: 1,
        paddingLeft: 2,
    },
};

/**
 * Props accepted by the <ApplicationProgress> component.
 */
interface ApplicationProgressProps {
    /**
     * Information about the application the user has made to a particular event and team.
     */
    application: EnvironmentContextApplication;

    /**
     * Information about the event for which progress is being displayed.
     */
    event: {
        /**
         * Short name of the event to contextualise the messaging.
         */
        shortName: string;

        /**
         * URL-safe slug of the event, used for referring them.
         */
        slug: string;
    };
}

/**
 * Specialisation of the <ApplicationProgress> component that will only be used when the application
 * was accepted by one of the volunteering leads. Details are shown on a more detailed page.
 */
export function ApplicationProgressAccepted(props: ApplicationProgressProps) {
    const router = useRouter();

    const navigateToApplication = useCallback(() => {
        router.push(`/registration/${props.event.slug}/application`);
    }, [ props.event, router ]);

    return (
        <Paper sx={deepmerge(kStyles.containerAccepted, kStyles.root)} elevation={1} square={true}
               onClick={navigateToApplication}>

            <AccordionSummary sx={deepmerge(kStyles.summary, kStyles.summaryAccepted)}>
                <Box sx={{ display: 'flex' }}>
                    <Box sx={kStyles.summaryIcon}>
                        <ThumbUpIcon fontSize="inherit" />
                    </Box>
                    <Typography variant="body2">
                        Your {props.application.teamName} participation has been <b>confirmed</b>
                    </Typography>
                </Box>

                <NavigateNextIcon fontSize="small" />

            </AccordionSummary>

        </Paper>
    );
}

/**
 * The <ApplicationProgress> component displays the progression of a volunteer's application to
 * participate in a particular event, regardless of the outcome of the application.
 */
export function ApplicationProgress(props: ApplicationProgressProps) {
    const { application, event } = props;

    const defaultOpen =
        !(typeof window !== 'undefined' && window.sessionStorage &&
          window.sessionStorage.getItem(kProgressExpansionStateName) === 'false');

    const [ open, setOpen ] = useState<boolean>(defaultOpen);

    function onProgressChange(scriptEvent: unknown, expanded: boolean) {
        try {
            sessionStorage.setItem(kProgressExpansionStateName, `${expanded}`);
            setOpen(expanded);

        } catch (error) {
            // This may happen in Safari's private browsing mode.
            console.warn(error);
        }
    }

    if (application.status === kRegistrationStatus.Accepted)
        return <ApplicationProgressAccepted {...props} />;

    let containerStyle: SxProps<Theme> = { /* no styles */ };
    let icon: React.ReactNode;
    let title: React.ReactNode;
    let explanation: React.ReactNode;

    switch (application.status) {
        case kRegistrationStatus.Registered:
            containerStyle = kStyles.containerRegistered;
            icon = <HowToVoteIcon fontSize="inherit" />;
            title = <>Your {props.application.teamName} application is <b>being considered</b></>;
            explanation = (
                <Typography variant="body2">
                    We have received your application for <strong>{event.shortName}</strong> and
                    have it under consideration. We will confirm your participation as soon as we
                    can. Please feel free to send us a message in case you have any questions.
                </Typography>
            );

            break;

        case kRegistrationStatus.Cancelled:
            containerStyle = kStyles.containerCancelledOrRejected;
            icon = <DoNotDisturbAltIcon fontSize="inherit" />;
            title = <>Your {props.application.teamName} participation has been <b>cancelled</b></>;
            explanation = (
                <Typography variant="body2">
                    Unfortunately you've withdrawn from participating in the
                    <strong> {event.shortName}</strong> team. We hope to welcome you next time!
                </Typography>
            );

            break;

        case kRegistrationStatus.Rejected:
            containerStyle = kStyles.containerCancelledOrRejected;
            icon = <DoNotDisturbAltIcon fontSize="inherit" />;
            title = <>Your {props.application.teamName} participation has been <b>declined</b></>;
            explanation = (
                <Typography variant="body2">
                    Unfortunately we have not been able to offer you participation in the
                    <strong> {event.shortName}</strong> team. You have received a message with more
                    information.
                </Typography>
            );

            break;
    }

    return (
        <Accordion onChange={onProgressChange} expanded={open} sx={containerStyle} disableGutters>
            <AccordionSummary sx={kStyles.summary} expandIcon={ <ExpandMoreIcon /> }>
                <Box sx={kStyles.summaryIcon}>
                    {icon}
                </Box>
                <Typography variant="body2">
                    {title}
                </Typography>
            </AccordionSummary>
            <AccordionDetails sx={kStyles.details}>
                <Divider sx={kStyles.divider} />
                {explanation}
            </AccordionDetails>
        </Accordion>
    );
}
