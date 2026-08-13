// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { GeminiIcon } from '@app/admin/components/icons/GeminiIcon';

/**
 * The <ProfilePromotionCard> displays a promotion to remind the user to complete their profile.
 * Doing so ensures the best possible results for our AI models.
 */
export async function ProfilePromotionCard() {
    return (
        <DashboardCard>
            <Stack direction="row" spacing={1.5}
                   divider={ <Divider flexItem orientation="vertical" /> }
                   sx={{
                        alignItems: 'center',
                        px: 2,
                        py: 1.5
                   }}>
                <GeminiIcon fontSize="large" />
                <Stack direction="column" sx={{ minWidth: 0 }}>
                   <Typography variant="subtitle2" noWrap>
                        You shouldn't sound like a robot 🤖
                   </Typography>
                   <Typography variant="body2">
                        Fill out your profile so the AI can learn your style and voice—less generic
                        mecha-chat, more you!
                   </Typography>
                </Stack>
                <IconButton component={Link} href="/admin/settings">
                    <NavigateNextIcon color="primary" />
                </IconButton>
            </Stack>
        </DashboardCard>
    );
}
