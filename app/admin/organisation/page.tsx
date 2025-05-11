// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { AccountSearchCard } from './dashboard/AccountSearchCard';
import { AccountWarningCard } from './dashboard/AccountWarningCard';
import { DisplaysCard } from './dashboard/DisplaysCard';
import { FeedbackCard } from './dashboard/FeedbackCard';
import { NardoCard } from './dashboard/NardoCard';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kDashboardPermissions } from './dashboard/DashboardPermissions';

/**
 * The <OrganisationPage> component describes the dashboard of our organisation area, which focuses
 * on providing fast access to account management and highlights potential warnings and issues that
 * could require the attention of one of our administrators.
 */
export default async function OrganisationPage() {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: kDashboardPermissions,
    });

    const canAccessAccounts = access.can('organisation.accounts');
    const canAccessDisplays = access.can('organisation.displays');
    const canAccessFeedback = access.can('organisation.feedback');

    return (
        <Grid container spacing={2}>
            { canAccessAccounts &&
                <Grid size={{ xs: 12 }}>
                    <AccountSearchCard />
                </Grid> }
            { (canAccessAccounts && (canAccessDisplays || canAccessFeedback)) &&
                <>
                    <Grid size={{ xs: 6 }}>
                        <AccountWarningCard />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <Stack direction="column" spacing={2}>
                            { canAccessDisplays && <DisplaysCard /> }
                            { canAccessFeedback && <FeedbackCard /> }
                            <NardoCard header />
                        </Stack>
                    </Grid>
                </> }
            { (canAccessAccounts && !(canAccessDisplays || canAccessFeedback)) &&
                <Grid size={{ xs: 12 }}>
                    <AccountWarningCard />
                </Grid> }
            { (!canAccessAccounts && canAccessDisplays) &&
                <Grid size={{ xs: 12 }}>
                    <DisplaysCard />
                </Grid> }
            { (!canAccessAccounts && canAccessFeedback) &&
                <Grid size={{ xs: 12 }}>
                    <FeedbackCard />
                </Grid> }
            { !canAccessAccounts &&
                <Grid size={{ xs: 12 }}>
                    <NardoCard />
                </Grid> }
        </Grid>
    );
}

export const metadata: Metadata = {
    title: 'Organisation | AnimeCon Volunteer Manager',
};
