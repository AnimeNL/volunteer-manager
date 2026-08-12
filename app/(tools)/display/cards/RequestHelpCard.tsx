// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { DisplayHelpRequestStatus, DisplayHelpRequestTarget } from '@lib/database/Types';
import { DisplayContext } from '../DisplayContext';
import { callApi } from '@lib/callApi';

import { kDisplayHelpRequestStatus, kDisplayHelpRequestTarget } from '@lib/database/Types';
import { kThemeImageVersion } from '@app/config';

/**
 * Props accepted by the <RequestHelpButton> component.
 */
interface RequestHelpButtonProps {
    /**
     * Callback that is to be invoked when the button is clicked on.
     */
    onClick?: () => void;

    /**
     * URL of the image that should be shown on the button.
     */
    image: string;

    /**
     * Label that should explain what the card is about.
     */
    label: string;
}

/**
 * The <RequestHelpButton> component displays a button through which help can be requested. Each
 * button has an image and a label, and must have a click handler for when it's activated.
 */
function RequestHelpButton(props: RequestHelpButtonProps) {
    return (
        <CardActionArea sx={{ borderRadius: 1, p: 1 }} onClick={props.onClick}>
            <Box sx={{
                backgroundImage: `url(${props.image})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                borderRadius: 1,
                marginBottom: 1,
                aspectRatio: 2,
                width: '100%',
            }} />
            <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                {props.label}
            </Typography>
        </CardActionArea>
    );
}

/**
 * Props accepted by the <RequestHelpCard> component.
 */
interface RequestHelpCardProps {
    /**
     * Whether advice can be requested through the card.
     */
    enableAdvice?: boolean;

    /**
     * The current status of the help request.
     */
    status?: DisplayHelpRequestStatus;
}

/**
 * The <RequestHelpCard> card displays the option for the location staff of this device to ping
 * one of the Volunteering Leads for help. A dialog will be shown with options about the nature of
 * their call, and the status of their request will be reflected in the card.
 */
export function RequestHelpCard(props: RequestHelpCardProps) {
    const { enableAdvice, status } = props;

    const display = useContext(DisplayContext);

    // ---------------------------------------------------------------------------------------------

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleOpen = useCallback(() => {
        if (!!status)
            return;  // a help request is already in progress

        setDialogOpen(true);

    }, [ status ]);

    const handleClose = useCallback(() => {
        setDialogOpen(false);
        setError(undefined);
        setLoading(false);
    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    const sendHelpRequest = useCallback(async (target: DisplayHelpRequestTarget) => {
        setError(undefined);
        setLoading(true);
        try {
            const response = await callApi('post', '/api/display/help-request', { target });
            if (!!response.success) {
                if (!!display.refresh)
                    await display.refresh();

                handleClose();
            } else {
                setError(response.error || 'The help request could not be issued');
            }
        } catch (error: any) {
            setError(error.message || 'The help request could not be issued');
        } finally {
            setLoading(false);
        }
    }, [ display, handleClose ]);

    const handleRequestCrew =
        useCallback(() => sendHelpRequest(kDisplayHelpRequestTarget.Crew), [ sendHelpRequest ]);
    const handleRequestNardo =
        useCallback(() => sendHelpRequest(kDisplayHelpRequestTarget.Nardo), [ sendHelpRequest ]);
    const handleRequestStewards =
        useCallback(() => sendHelpRequest(kDisplayHelpRequestTarget.Stewards), [ sendHelpRequest ]);

    // ---------------------------------------------------------------------------------------------

    return (
        <Paper>
            <Box sx={{
                backgroundImage: `url(/images/theme/request-help.jpg?${kThemeImageVersion})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                borderTopLeftRadius: theme => theme.shape.borderRadius,
                borderTopRightRadius: theme => theme.shape.borderRadius,
                filter: 'grayscale(0.1)',
                width: '100%',
                aspectRatio: 3.5 }} />
            <CardActionArea onClick={handleOpen} sx={{ p: 2 }}>
                <Typography variant="body1" sx={{ pb: 2 }}>
                    You can request help from a Volunteering Lead in case of safety or security
                    concerns, or when scheduled volunteers did not show up.
                </Typography>
                { status === kDisplayHelpRequestStatus.Acknowledged &&
                    <Button fullWidth color="warning" variant="contained"
                            startIcon={ <CircularProgress color="inherit" thickness={6}
                                                          size={16} sx={{ mr: 0.5 }} /> }>
                        Help is on its way
                    </Button> }
                { status === kDisplayHelpRequestStatus.Pending &&
                    <Button fullWidth color="error" variant="contained"
                            startIcon={ <CircularProgress color="inherit" thickness={6}
                                                          size={16} sx={{ mr: 0.5 }} /> }>
                        Help has been requested
                    </Button> }
                { !status &&
                    <Button fullWidth color="secondary" variant="outlined">
                        Request help…
                    </Button> }
            </CardActionArea>
            <Dialog open={dialogOpen} onClose={handleClose} fullWidth>
                <DialogTitle>
                    What do you need help with?
                </DialogTitle>
                <DialogContent sx={{ pb: 0 }}>
                    <DialogContentText>
                        Your request will be sent to to Volunteering Leads immediately, and someone
                        will come by at their earliest convenience.
                    </DialogContentText>
                    <Divider sx={{ mt: 2 }} />
                    <Stack direction="row" spacing={2} sx={{
                        justifyContent: 'space-evenly',
                        marginTop: 2
                    }}>
                        <RequestHelpButton onClick={handleRequestCrew}
                                           image="/images/request-help-crew.jpg"
                                           label="Volunteers" />
                        <RequestHelpButton onClick={handleRequestStewards}
                                           image="/images/request-help-stewards.jpg"
                                           label="Stewards" />
                        { !!enableAdvice &&
                            <RequestHelpButton onClick={handleRequestNardo}
                                               image="/images/request-help-nardo.jpg"
                                               label="Del a Rie Advies" /> }
                    </Stack>
                    <Divider sx={{ mt: 1 }} />
                    <Collapse in={!!error}>
                        <Alert severity="error" variant="outlined">
                            {error}
                        </Alert>
                    </Collapse>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between', pr: 2 }}>
                    <Box sx={{ pl: 2 }}>
                        { !!loading &&
                            <CircularProgress color="inherit" thickness={6} size={16} /> }
                    </Box>
                    <Button color="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
