// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useRouter } from 'next/navigation';

import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import { Section } from '@app/admin/components/Section';

/**
 * The <DebugOptions> component displays a number of client-side options that help run arbitrary
 * JavaScript code and event handlers.
 */
export function DebugOptions() {
    const router = useRouter();

    const triggerJavaScriptError = () => {
        /// @ts-ignore
        callFunctionThatDoesNotExist();
    };

    const triggerJavaScriptException = () => {
        throw new Error('Name of the exception');
    };

    const refresh = () => {
        router.refresh();
    };

    return (
        <Section icon={ <BuildOutlinedIcon /> } title="Debugging options">
            <Stack direction="row" spacing={2}>
                <Button onClick={triggerJavaScriptError} variant="contained">
                    JavaScript error
                </Button>
                <Button onClick={triggerJavaScriptException} variant="contained">
                    JavaScript exception
                </Button>
                <Button onClick={refresh} variant="contained">
                    Refresh
                </Button>
            </Stack>
        </Section>
    );
}
