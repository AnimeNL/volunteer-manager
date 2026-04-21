// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import Alert, { alertClasses } from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <VisibilityToggle> component.
 */
interface VisibilityToggleProps {
    /**
     * Whether the incident has been hidden from view.
     */
    hidden: boolean;

    /**
     * Server Action to invoke when visibility is being updated.
     */
    toggleFn: ServerAction;
}

/**
 * The <VisibilityToggle> component conveniently enables an administrator to toggle visibility of
 * the details in a particular Duty Book incident, in case it contains sensitive information.
 */
export function VisibilityToggle(props: VisibilityToggleProps) {
    const router = useRouter();

    const toggle = useCallback(async (hidden: 'true' | 'false') => {
        const formData = new FormData();
        formData.set('hidden', hidden);

        await props.toggleFn(formData);
        router.refresh();

    }, [ props.toggleFn, router ]);

    return (
        <Alert severity={ props.hidden ? 'info' : 'warning' }
               sx={{
                   [`& .${alertClasses.message}`]: {
                       flexGrow: 1,
                       py: 0.5,
                   },
                   transition: 'background-color ease-in .3s'
               }} >
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="inherit">
                    { !props.hidden &&
                        'The details of this incident are visible to all volunteers.' }
                    { !!props.hidden &&
                        'The details of this incident have been hidden from volunteers.' }
                </Typography>
                { !props.hidden &&
                    <Button onClick={() => toggle('true')} size="small">
                        Hide
                    </Button> }
                { !!props.hidden &&
                    <Button onClick={() => toggle('false')} size="small">
                        Unhide
                    </Button> }
            </Stack>
        </Alert>
    );
}
