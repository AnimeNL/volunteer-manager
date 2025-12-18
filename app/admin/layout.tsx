// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AdminClientProviders } from './AdminClientProviders';
import { AdminHeader } from './AdminHeader';
import { MuiLicense } from '../components/MuiLicense';
import { determineEnvironment } from '@lib/Environment';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { readUserSettings } from '@lib/UserSettings';

/**
 * URL that the user should navigate to when clicking on the build hash.
 */
const kVersionLink = 'https://github.com/beverloo/volunteer-manager';

/**
 * Layout of the administration section of the Volunteer Manager. The layout is the same for every
 * (signed in) user, although the available options will depend on the user's access level.
 */
export default async function RootAdminLayout(props: LayoutProps<'/admin'>) {
    const { access, user } = await requireAuthenticationContext({ check: 'admin' });

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const settings = await readUserSettings(user.id, [
        'ai-example-messages',
        'user-admin-experimental-dark-mode',
        'user-admin-experimental-responsive',
        'user-ai-example-messages-promo-time',
    ], /* disableFallback= */ true);

    // Determine the palette mode for the administration area. Dark Mode is not officially supported
    // just yet, but can be experimentally enabled through user settings.
    const paletteMode = !!settings['user-admin-experimental-dark-mode'] ? 'dark' : 'light';

    return (
        <>
            <MuiLicense />
            <AdminClientProviders paletteMode={paletteMode} palette={environment.colours}>
                <Box sx={{ overflow: 'auto' }}>
                    <Box sx={{
                        backgroundColor: 'background.default',
                        minHeight: '100vh',
                        minWidth:
                            !!settings['user-admin-experimental-responsive'] ? undefined
                                                                             : 1280,
                        padding: 2,
                    }}>

                        <AdminHeader access={access} user={user} settings={settings} />

                        {props.children}

                        <Typography component="footer" align="center" variant="body2"
                                    color="textPrimary" sx={{ mt: 1 }}>
                            AnimeCon Volunteer Manager (
                            <MuiLink href={kVersionLink}>{process.env.buildHash}</MuiLink>) —
                            © 2015–{ (new Date()).getFullYear() }
                        </Typography>

                    </Box>
                </Box>
            </AdminClientProviders>
        </>
    );
}
