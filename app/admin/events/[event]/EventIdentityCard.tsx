// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <EventIdentityCard> component.
 */
interface EventIdentityCardProps {
    event: {
        /**
         * Hash of the file at which the event's identity image has been stored.
         */
        identityHash?: string;

        /**
         * Full name of the event, displayed when no identity image is available.
         */
        name: string;
    };
}

/**
 * The <EventDateCard> component displays the event's logo in a styled, aspect-ratio'd box. This
 * should help as a quick indication to the volunteer about which event is being displayed.
 */
export function EventIdentityCard(props: EventIdentityCardProps) {
    const { identityHash, name } = props.event;

    if (!!identityHash) {
        return <Paper sx={{ minHeight: '100%', height: '100%',
                            backgroundImage: `url(/blob/${identityHash}.png)`,
                            backgroundSize: 'cover', backgroundPosition: 'center center' }} />;
    }

    return (
        <Paper sx={{ p: 2, minHeight: '100%', height: '100%' }}>
            <Stack direction="column" justifyContent="center" sx={{ height: '100%' }}>
                <Typography variant="h5" align="center">
                    {name}
                </Typography>
                <Typography variant="caption" align="center" sx={{ pt: 1 }}>
                    (no image available)
                </Typography>
            </Stack>
        </Paper>
    );
}
