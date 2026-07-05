// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { DashboardCardHeader } from './DashboardCardHeader';

/**
 * The <ActivityCard> displays the most recent actions that were taken in the Volunteer Manager, and
 * by who. It's a quick way to understand whether something has changed since your last visit.
 */
export async function ActivityCard() {
    return (
        <DashboardCard>
            <DashboardCardHeader src="/images/admin/activity-header.jpg?v2"
                                 title="Database" secondary />
            <Stack sx={{ px: 2, pb: 1 }}>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Recent activity
                </Typography>
                <Typography variant="body2">
                    Not yet implemented.
                </Typography>
            </Stack>
        </DashboardCard>
    );
}
