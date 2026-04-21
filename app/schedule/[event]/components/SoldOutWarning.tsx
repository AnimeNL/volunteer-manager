// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Displays a warning that the content on the displayed page has sold out.
 */
export function SoldOutWarning() {
    return (
        <Stack component={Paper} direction="row" spacing={2} sx={{
            alignItems: 'center',
            paddingX: 2,
            paddingY: 1
        }}>
            <LocalActivityIcon color="error" />
            <Typography variant="body2" color="error">
                All tickets for this event have been sold
            </Typography>
        </Stack>
    );
}
