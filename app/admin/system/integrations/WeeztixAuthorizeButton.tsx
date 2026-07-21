// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import IconButton from '@mui/material/IconButton';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ConfirmationDialog } from '@app/admin/components/ConfirmationDialog';

/**
 * Props accepted by the <WeeztixAuthorizeButton> component.
 */
interface WeeztixAuthorizeButtonProps {
    /**
     * Settings that are required for the authorization dialog to function.
     */
    settings: {
        /**
         * Client ID provided to us by the Weeztix dashboard.
         */
        clientId: string;

        /**
         * Redirect URL where the authorization code will be shared with.
         */
        redirectUrl: string;
    };

    /**
     * A (random) identifier, which we use to identify the response.
     */
    state: string;
}

/**
 * Button through which the OAuth access and refresh tokens for Weeztix can be obtained. This is a
 * regular OAuth flow for which we've made a redirection URL available.
 */
export function WeeztixAuthorizeButton(props: WeeztixAuthorizeButtonProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleCloseDialog = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);
    const handleOpenDialog = useCallback(() => setDialogOpen(true), [ /* no dependencies */ ]);

    const router = useRouter();

    const handleAuthorizationFlow = useCallback(async () => {
        const urlParams = new URLSearchParams();
        urlParams.set('client_id', props.settings.clientId);
        urlParams.set('redirect_uri', props.settings.redirectUrl);
        urlParams.set('response_type', 'code');
        urlParams.set('state', props.state);

        const urlBase = 'https://login.weeztix.com/login';
        const url = `${urlBase}?${urlParams.toString()}`;

        router.push(url);

        return true as const;

    }, [ props.settings.clientId, props.settings.redirectUrl, props.state, router ]);

    return (
        <>
            <IconButton size="small" onClick={handleOpenDialog}>
                <Tooltip title="OAuth authorization...">
                    <LockOpenIcon color="primary" fontSize="small" />
                </Tooltip>
            </IconButton>
            <ConfirmationDialog open={dialogOpen} onClose={handleCloseDialog} confirmLabel="Proceed"
                                onConfirm={handleAuthorizationFlow}
                                title="Authorize with Weeztix?">
                <Typography variant="body2">
                    You are about to start the OAuth authentication flow with Weeztix which will
                    override current credentials. Are you sure that you want to proceed?
                </Typography>
            </ConfirmationDialog>
        </>
    );
}
