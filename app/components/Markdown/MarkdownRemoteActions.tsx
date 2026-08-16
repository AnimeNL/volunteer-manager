// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';

import { executeServerAction } from '@lib/serverAction';

/**
 * Server Action to fetch remote content with a given identifier.
 */
export async function fetchRemoteContent(input: unknown) {
    return executeServerAction(input, z.object({ id: z.string() }), async (data, props) => {
        // TODO: Support different kinds of remote content to be injected, specifically for dynamic
        // data such as hotel pricing, training availability and so on.

        return {
            success: true,
            markdown: (
                <Alert severity="warning" variant="outlined">
                    Unable to inject remote content, identifier ("{data.id}") is unsupported.
                </Alert>
            ),
        };
    }, /* allowVisitors= */ true);
}
