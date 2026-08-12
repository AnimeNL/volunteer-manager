// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Stack from '@mui/material/Stack';

import { DisplayContainer } from './DisplayContainer';
import { DisplayController } from './DisplayController';
import { DisplayHeader } from './DisplayHeader';

/**
 * The <DisplayLayout> component is the root layout of the Volunteer Manager Display, which shows
 * the System UI substitute and the container within which the content is displayed. Most of the
 * interaction with the device—including the ability to request help—will be provided here.
 */
export default function DisplayLayout(props: LayoutProps<'/display'>) {
    return (
        <DisplayController>
            <Stack direction="column" spacing={4} sx={{ p: 4, height: '100%' }}>
                <DisplayHeader />
                <DisplayContainer>
                    {props.children}
                </DisplayContainer>
            </Stack>
        </DisplayController>
    );
}

export const metadata: Metadata = {
    title: 'AnimeCon Volunteering Teams | Display app',
};
