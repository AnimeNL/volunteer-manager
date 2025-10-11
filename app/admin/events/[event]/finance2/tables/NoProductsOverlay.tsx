// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Overlay used in the MUI Data Grid component when no lockers could be found, which is quite
 * commonly the case early on during festival organisation.
 */
function InternalOverlay(label: string) {
    return (
        <Stack direction="column" alignItems="center" justifyContent="center"
               sx={{ height: '100%' }}>
            <LocalActivityIcon color="disabled" fontSize="large" />
            <Typography color="textDisabled" variant="body2">
                {label}

            </Typography>
        </Stack>
    );
}

/**
 * Overlays that can be used by the different tables displaying sales data.
 */
export const NoLockersOverlay = InternalOverlay.bind(null, 'Lockers will appear here…');
export const NoProductsOverlay = InternalOverlay.bind(null, 'Event tickets will appear here…');
export const NoTicketsOverlay = InternalOverlay.bind(null, 'Tickets will appear here…');