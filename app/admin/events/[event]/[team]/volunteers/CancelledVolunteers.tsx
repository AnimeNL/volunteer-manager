// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ContrastBox } from '@app/admin/components/ContrastBox';

/**
 * Props accepted by the <CancelledVolunteers> component.
 */
interface CancelledVolunteersProps {
    /**
     * The volunteers that have cancelled.
     */
    volunteers: {
        id: number;
        name: string;
        role: string;
    }[];
}

/**
 * The <CancelledVolunteers> component displays the volunteers who once participated in this event
 * but have since cancelled. They're shown as a concise list.
 */
export function CancelledVolunteers(props: CancelledVolunteersProps) {
    const { volunteers } = props;

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
                No longer participating
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                These volunteers cancelled their participation and are not expected to help out.
                They will be omitted in the scheduling tools.
            </Alert>
            <Stack direction="column" spacing={2}>
                { volunteers.map((volunteer, index) =>
                    <Stack component={ContrastBox} direction="row" key={index} sx={{ p: 1 }}>
                        <MuiLink component={Link} href={`./volunteers/${volunteer.id}`}>
                            {volunteer.name}
                        </MuiLink>
                        <Typography sx={{ ml: .75 }}>
                            ({volunteer.role})
                        </Typography>
                    </Stack> )}
            </Stack>
        </Paper>
    )
}
