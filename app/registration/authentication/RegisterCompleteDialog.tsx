// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { useCallback, useEffect, useState } from 'react';

import { default as MuiLink } from '@mui/material/Link';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';

import { callApi } from '@lib/callApi';


/**
 * Props accepted by the <RegisterCompleteDialog> component.
 */
interface RegisterCompleteDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: (redirectUrl?: string) => void;

    /**
     * The registration request for which we are confirming the e-mail address' validity.
     */
    registrationRequest: string;
}

/**
 * The <RegisterCompleteDialog> dialog receives the registration request token, verifies this with
 * the server and then signs the user in to their account, after which it has been activated.
 */
export function RegisterCompleteDialog(props: RegisterCompleteDialogProps) {
    const { onClose, registrationRequest } = props;

    const [ firstName, setFirstName ] = useState<string | undefined>();
    const [ teamName, setTeamName ] = useState<string | undefined>();

    const [ redirectUrl, setRedirectUrl ] = useState<string | undefined>();

    const [ requestValid, setRequestValid ] = useState<boolean | undefined>(undefined);

    // Proxies the `onClose` callback to include the `redirectUrl`, which enables the user to be
    // automatically forwarded back to the URL they were on when registering their account.
    const onRequestClose = useCallback(() => {
        onClose(redirectUrl);
    }, [ onClose, redirectUrl ]);

    // Verify the registration request through the authentication endpoint, which will also tell
    // us about the user's first name to display in the dialog and signs the user in.
    useEffect(() => {
        callApi('post', '/api/auth/register-activate', {
            registrationRequest,
        }).then(response => {
            setTimeout(() => {
                setRequestValid(response.success);

                setFirstName(response.firstName);
                setTeamName(response.teamName);
                setRedirectUrl(response.redirectUrl);

            }, 500);
        });
    }, [ registrationRequest ]);

    return (
        <>
            <DialogTitle>Create an account</DialogTitle>
            { requestValid === undefined &&
                <DialogContent>
                    <Skeleton animation="wave" height={16} sx={{ mb: 1 }} />
                    <Skeleton animation="wave" height={16} width="80%" />
                </DialogContent> }
            { requestValid === true &&
                <>
                    <DialogContent>
                        <DialogContentText>
                            Your account has been created, {firstName}, and you have been signed in
                            straight away. <strong>Remember that you need to apply to help out as
                            a volunteer!</strong>
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        { !!redirectUrl  &&
                            <Button onClick={onRequestClose} variant="contained" fullWidth
                                    color="primary" sx={{ mb: 1, ml: 1 }}>
                                Join the {teamName ?? 'AnimeCon Team'} today!
                            </Button> }
                        { !redirectUrl &&
                            <Button onClick={onRequestClose} variant="contained">
                                Close
                            </Button> }
                    </DialogActions>
                </> }
            { requestValid === false &&
                <>
                    <DialogContent>
                        <DialogContentText>
                            This account activation link no longer is valid. Please try signing in
                            your account or&nbsp;
                            <MuiLink component={Link} href="mailto:crew@animecon.nl">
                                send us a message
                            </MuiLink>
                            &nbsp;in case something is not working.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onRequestClose} variant="contained">Close</Button>
                    </DialogActions>
                </> }
        </>
    );
}
