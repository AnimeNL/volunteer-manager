// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * The <NoVolunteersCard> component signals that no volunteers are scheduled to be present at the
 * location at this very moment.
 */
export function NoVolunteersCard() {
    return (
        <Stack component={Paper} variant="outlined" sx={{
            minHeight: '224px',  // aligned with the "request help" card
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderStyle: 'dashed',
            justifyContent: 'center',
            p: 2
        }}>
            <Typography sx={{ color: 'text.disabled' }}>
                No volunteers are currently scheduled at this location.
            </Typography>
        </Stack>
    );
}
