// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The AI page contains the prompt configuration used for our use of Generative AI throughout the
 * volunteer portal. The page is protected behind a special permission.
 */
export default async function NardoAiPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.ai',
    });

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12 }} sx={{ mb: -1 }}>
                <Typography variant="h6">
                    Personalised Advice
                </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
                TODO (Prompt)
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                TODO (Example)
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>

            <Grid size={{ xs: 12 }} sx={{ mb: -1 }}>
                <Typography variant="h6">
                    Personalised Gift
                </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
                TODO (Prompt)
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                TODO (Example)
            </Grid>
        </Grid>
    );
}

export const metadata: Metadata = {
    title: 'Del a Rie Advies | Artificial Intelligence | AnimeCon Volunteer Manager',
};
