// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeAccessCheck } from "@lib/auth/AuthenticationContext";
import { executeServerAction } from "@lib/serverAction";
import { getStaticContent } from '@lib/Content';

/**
 * Server action that fetches the documentation for the given `topic`. It's rendered using Markdown
 * on the server, with the JSX thereafter shared to the client.
 */
export async function fetchDocumentation(topic: string) {
    'use server';
    return executeServerAction({ topic }, z.object({ topic: z.string() }), async (data, props) => {
        executeAccessCheck(props.authenticationContext, { check: 'admin' });

        const content = await getStaticContent([ 'documentation', ...data.topic.split('/') ], {
            substitutions: {
                firstName: props.user.firstName,
                name: props.user.name,
            },
            variant: 'body2',
        });

        if (!content)
            return { success: false, error: 'Documentation for this page is not available yet.' };

        return {
            success: true,
            markdown: content.markdown,
        };
    });
}
