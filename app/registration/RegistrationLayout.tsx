// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy'
import { useMemo, useState } from 'react';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Container, { type ContainerProps } from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { darken } from '@mui/material/styles';

import type { Environment, EnvironmentDomain } from '@lib/Environment';
import { AuthenticationContext, AuthenticationContextManager } from './AuthenticationContext';

/**
 * Styles that are to be applied to the <object> element that hosts our logo. This is an SVG file
 * that should by dynamically sized according to the viewport, contained within an <a> element which
 * should be activated when a user clicks on the logo.
 */
export const kLogoContainerStyles: React.CSSProperties = {
    cursor: 'pointer',
    pointerEvents: 'none',
    width: '256px',
    maxWidth: '40vw'
};

/**
 * Generates the background styles for the given `environment`, which determines the resources that
 * will be used for the background images across both mobile and desktop.
 */
const generateBackgroundStylesForEnvironment = (environment: EnvironmentDomain) => ({
    position: 'fixed',
    zIndex: -1,

    width: '100vw',
    height: '100vh',

    backgroundAttachment: 'fixed',
    backgroundPosition: 'bottom right',
    backgroundSize: 'cover',
    backgroundImage: {
        xs: `url(/images/${environment}/background-mobile.jpg?v2)`,
        sm: `url(/images/${environment}/background-desktop.jpg?v2)`,
    },
}) as const;

/**
 * Props accepted by the <RegistrationLayout> component. Will be called by NextJS.
 */
interface RegistrationLayoutProps {
    /**
     * The environment for which the layout will be displayed. Decides on the layout and graphics
     * that will be used, which can be customised for the different sites.
     */
    environment: Environment;

    /**
     * Maximum width for the container layout. Defaults to "lg" in line with MUI standards.
     */
    maxWidth?: ContainerProps['maxWidth'];
}

/**
 * The <RegistrationLayout> component represents the main layout used for both the Welcome and the
 * Registration apps, which welcome volunteers and invite them to join our teams.
 */
export function RegistrationLayout(props: React.PropsWithChildren<RegistrationLayoutProps>) {
    const { environment } = props;

    const year = useMemo(() => (new Date).getFullYear(), [ /* no dependencies */ ]);
    const logoUrl = useMemo(() => {
        const params = new URLSearchParams([
            [ 'color', darken(environment.colours.light, .3) ],
            [ 'title', environment.title ],
        ]);

        return '/images/logo.svg?' + params.toString();

    }, [ environment.title, environment.colours.light ]);

    const [ authenticationContext ] = useState(new AuthenticationContextManager);

    return (
        <>
            <Box sx={ generateBackgroundStylesForEnvironment(environment.domain) } />
            <Container maxWidth={props.maxWidth} sx={{ pb: 2 }}>
                <Container sx={{ py: 2, textAlign: 'center' }}>
                    <Link href="/" style={{ display: 'inline-block' }}>
                        <object type="image/svg+xml" style={kLogoContainerStyles} data={logoUrl} />
                    </Link>
                </Container>
                <AuthenticationContext.Provider value={authenticationContext}>
                    {props.children}
                </AuthenticationContext.Provider>
                <Typography align="center" variant="body2" sx={{ mt: 1 }}>
                    AnimeCon Volunteer Portal (
                    <MuiLink href="https://github.com/beverloo/volunteer-manager" color="inherit">
                        {process.env.buildHash}
                    </MuiLink>) — © 2015–{year}
                </Typography>
            </Container>
        </>
    );
}
