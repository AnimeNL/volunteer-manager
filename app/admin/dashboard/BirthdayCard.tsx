// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { DashboardCardHeader } from './DashboardCardHeader';

/**
 * The <BirthdayCard> displays the recent and upcoming birthdays of volunteers. The specific list of
 * volunteers will be filtered depending on the signed in user's access.
 */
export async function BirthdayCard() {
    // TODO: Filter by access

    return (
        <DashboardCard>
            <DashboardCardHeader src="/images/admin/birthday-header.jpg?v2"
                                 title="Database" secondary />
            <Stack sx={{ px: 2, pb: 1 }}>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Birthdays
                </Typography>
                <Typography variant="body2">
                    Not yet implemented.
                </Typography>
            </Stack>
        </DashboardCard>
    );
}
