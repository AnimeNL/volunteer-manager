// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

import type { Environment } from '@lib/Environment';
import { Markdown } from '@components/Markdown';

/**
 * Props accepted by the <NoEventsContent> component.
 */
interface NoEventsContentProps {
    /**
     * The environment for which the landing page is being shown.
     */
    environment: Environment;
}

/**
 * The <NoEventsContent> component represents the case when there are no accessible events to be
 * shown to the user. This, ideally, should never happen, but it's possible.
 */
export function NoEventsContent(props: NoEventsContentProps) {
    return (
        <>
            <Alert severity="error" sx={{ m: 2, mb: 0 }}>
                Looks like there's nothing happening right now—but exciting things may be on the
                way! Check back soon!
            </Alert>
            <Box sx={{ p: 2 }}>
                <Markdown content={props.environment.description} />
            </Box>
        </>
    );
}
