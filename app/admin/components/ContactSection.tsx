// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <ContactSection> component.
 */
interface ContactSectionProps {
    /**
     * Name of the person whom to send a communication to.
     */
    name: string;
}

/**
 * Shared layout component through which contact can be conveniently established with a person.
 */
export function ContactSection(props: React.PropsWithChildren<ContactSectionProps>) {
    return (
        <Paper sx={{
            backgroundColor: 'backgroundHighlight',
            paddingX: 2,
            paddingY: 1
        }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    You're most welcome to send {props.name} an e-mail—use this action to get
                    started.
                </Typography>
                <Divider flexItem orientation="vertical" />
                <Suspense fallback={ <CircularProgress color="inherit" size="24px" /> }>
                    {props.children}
                </Suspense>
            </Stack>
        </Paper>
    );
}
