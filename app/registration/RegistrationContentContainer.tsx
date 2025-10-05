// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import Paper from '@mui/material/Paper';

import type { User } from '@lib/auth/User';
import { AuthenticationContext } from './AuthenticationContext';
import { LazyAuthenticationFlow } from '../registration/LazyAuthenticationFlow';
import { RegistrationHeader } from './RegistrationHeader';

/**
 * Props accepted by the <RegistrationContentContainer> component.
 */
interface RegistrationContentContainerProps {
    /**
     * Children that should be rendered within the registration content container.
     */
    children?: React.ReactNode;

    /**
     * Title of the page that should be displayed
     */
    title?: string;

    /**
     * When passed, will be considered by the authentication flow as the redirect URL in case the
     * visitor still has to create a new account.
     */
    redirectUrl?: string;

    /**
     * Information about the signed in user, as they should be shown in the header.
     */
    user?: User;
}

/**
 * The content container component encapsulates functionality that should be available across
 * various parts of the portal without being opinionated about the actual contents.
 */
export function RegistrationContentContainer(props: RegistrationContentContainerProps) {
    // The authentication flow should be opened automatically when the `password-reset-request` or
    // the `registration-request` parameter is included in the URL's search parameters.
    const searchParams = useSearchParams();
    const initialAuthFlowOpen = searchParams.has('password-reset-request') ||
                                searchParams.has('registration-request');

    const authenticationContext = useContext(AuthenticationContext);

    const [ authFlowOpen, setAuthFlowOpen ] = useState<boolean>(initialAuthFlowOpen);
    const [ authFlowRedirectUrl, setAuthFlowRedirectUrl ] = useState<string | undefined>();

    // Observe requests for the authentication context to be opened from within the rendering tree
    // of the <RegistrationLayout>.
    useEffect(() => {
        const listener = (authFlowRedirectUrl?: string) => {
            setAuthFlowRedirectUrl(authFlowRedirectUrl);
            setAuthFlowOpen(true);
        };

        authenticationContext.attachRequestListener(listener);
        return () => authenticationContext.detachRequestListener(listener);

    }, [ authenticationContext ]);

    return (
        <>
            <Paper elevation={2}>
                <RegistrationHeader onUserChipClick={() => setAuthFlowOpen(true)}
                                    title={props.title ?? 'AnimeCon Volunteer Manager'}
                                    user={props.user} />

                {props.children}

            </Paper>
            <LazyAuthenticationFlow onClose={() => setAuthFlowOpen(false)}
                                    open={authFlowOpen}
                                    passwordResetRequest={
                                        searchParams.get('password-reset-request')!}
                                    registrationRedirectUrl={
                                        authFlowRedirectUrl ?? props.redirectUrl}
                                    registrationRequest={
                                        searchParams.get('registration-request')!}
                                    user={props.user} />
        </>
    );
}
