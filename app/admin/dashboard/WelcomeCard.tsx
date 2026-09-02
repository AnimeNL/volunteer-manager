// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { DashboardCardTitle } from './DashboardCardTitle';

/**
 * The <WelcomeCard> welcomes a volunteer to the new administration area, with a mild warning that
 * certain features have not been migrated yet.
 */
export async function WelcomeCard() {
    return (
        <DashboardCard highlight>
            <DashboardCardTitle icon={ <EmojiPeopleIcon /> }>
                Welcome!
            </DashboardCardTitle>
            <Typography variant="body2" sx={{ px: 2, pb: 2, pt: 1 }}>
                Managing AnimeCon's volunteers just got an upgrade: sleeker, mobile-ready, and easy
                on the eyes. Not all tools have fully migrated yet, so stay tuned for more changes
                and please let Peter know if you run into any issues.
            </Typography>
        </DashboardCard>
    );
}
