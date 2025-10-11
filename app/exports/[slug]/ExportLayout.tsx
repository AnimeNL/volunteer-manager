// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy'

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { kLogoContainerStyles } from '@app/registration/RegistrationLayout';

/**
 * Props accepted by the <ExportLayout> component.
 */
interface ExportLayoutProps {
    /**
     * Name of the event for which the page is being displayed.
     */
    eventName: string;
}

/**
 * The <ExportLayout> is the common layout shared by the exports sub-app. It shows a minimalistic
 * user interface branding our environment, our privacy policy and contact information.
 */
export function ExportLayout(props: React.PropsWithChildren<ExportLayoutProps>) {
    const params = new URLSearchParams([
        [ 'color', /* AnimeCon blue= */ '#06213b' ],
        [ 'title', 'Volunteering Teams' ],
    ]);

    return (
        <Stack direction="column" alignItems="center" justifyContent="center"
               sx={{
                   p: 2,
                   minHeight: '100vh',
                   backgroundColor:
                       theme => theme.palette.mode === 'light' ? '#ECEFF1' : '#424242',
               }}>

            <Stack direction="column" alignItems="stretch" justifyContent="center"
                   sx={{ minWidth: '85%', maxWidth: 'min-content' }} spacing={2}>

                <Box component="header" sx={{ alignSelf: 'center' }}>
                    <Link href="/" style={{ display: 'inline-block' }}>
                        <object type="image/svg+xml" style={kLogoContainerStyles}
                                data={'/images/logo.svg?' + params} />
                    </Link>
                </Box>

                {props.children}

                <Typography variant="body1"
                            sx={{ p: 1, textAlign: 'center', color: 'text.primary' }}>

                    {props.eventName} —{' '}
                    <MuiLink component={Link} href="/privacy">
                        Privacy Policy
                    </MuiLink> —{' '}
                    <MuiLink component={Link} href="mailto:crew@animecon.nl">
                        crew@animecon.nl
                    </MuiLink>

                </Typography>

            </Stack>

        </Stack>
    );
}
