// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import Grid from '@mui/material/Grid';
import PasswordIcon from '@mui/icons-material/Password';
import Typography from '@mui/material/Typography';

import type { User } from '@lib/auth/User';
import { Avatar } from '@components/Avatar';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <IdentityDialog> component.
 */
interface IdentityDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the user's account settings should be displayed.
     */
    onRequestAccount: () => void;

    /**
     * To be invoked when the user's passkey settings should be displayed.
     */
    onRequestPasskeys: () => void;

    /**
     * To be invoked when the user's password settings should be displayed.
     */
    onRequestPassword: () => void;

    /**
     * To be invoked when the user wants to sign out of their account. Requires an API call.
     */
    onSignOut: () => Promise<void>;

    /**
     * Information about the signed in user. The Identity dialog can only be shown for signed in
     * users, otherwise there wouldn't be anything to display.
     */
    user: User;
}

/**
 * The <IdentityDialog> dialog displays information about the signed in user, and gives them the
 * ability to sign out of their account. We also display a series of badges, one per events in which
 * they participated, kind of as a collectable.
 */
export function IdentityDialog(props: IdentityDialogProps) {
    const { onClose, onSignOut, user } = props;
    const router = useRouter();

    // TODO: Badges
    // TODO: Refer to sign-up for future events?

    const [ loading, setLoading ] = useState<boolean>(false);
    const requestSignOut = useCallback(async () => {
        setLoading(true);

        try {
            await onSignOut();
        } finally {
            setLoading(false);
        }
    }, [ onSignOut ]);

    const requestAvatarUpdate = useCallback(async (avatar: Blob) => {
        try {
            const base64Header = 'data:image/png;base64,';
            const base64Avatar = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend =
                    () => resolve((reader.result as string).substring(base64Header.length));
                reader.readAsDataURL(avatar);
            });

            const response = await callApi('post', '/api/auth/update-avatar', {
                avatar: base64Avatar as string,
            });

            if (response.success)
                router.refresh();

            return response.success;

        } catch (error) {
            console.error('Unable to upload a new avatar:', error);
        }

        return false;

    }, [ router ]);

    return (
        <>
            <DialogContent>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }} sx={{
                        alignItems: 'center',
                        display: 'flex',
                        justifyContent: 'center',
                    }}>
                        <Avatar editable onChange={requestAvatarUpdate} size="large"
                                src={user.avatarUrl}>
                            {user.firstName} {user.lastName}
                        </Avatar>
                    </Grid>
                    <Grid size={{ xs: 12, md: 9 }}>
                        <Typography variant="h6">
                            { user.displayName ?? `${user.firstName} ${user.lastName}` }
                        </Typography>
                        { !!user.displayName &&
                            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                also known as {user.firstName} {user.lastName}
                            </Typography> }
                        <Typography>
                            You are signed in to your account.
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <Divider />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Button variant="outlined" fullWidth startIcon={ <AccountCircleIcon /> }
                                onClick={props.onRequestAccount}>
                            Account
                        </Button>
                    </Grid>
                    { !!browserSupportsWebAuthn() &&
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Button loading={false} variant="outlined" fullWidth
                                    onClick={props.onRequestPasskeys}
                                    startIcon={ <FingerprintIcon /> }>
                                Passkeys
                            </Button>
                        </Grid> }
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Button variant="outlined" fullWidth startIcon={ <PasswordIcon /> }
                                onClick={props.onRequestPassword}>
                            Password
                        </Button>
                    </Grid>

                </Grid>
                <Divider sx={{ pt: 2, mb: -1 }} />
            </DialogContent>
            <DialogActions>
                <Button loading={loading} onClick={requestSignOut}>
                    Sign out
                </Button>
                <Button onClick={onClose} variant="contained">Close</Button>
            </DialogActions>
        </>
    );
}
