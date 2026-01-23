// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { unauthorized } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../../Types';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getStaticContent } from '@lib/Content';

/**
 * Interface definition for the Documentation API, accessible through /api/admin/documentation.
 */
export const kGetDocumentationDefinition = z.object({
    request: z.object({
        /**
         * Topic for which documentation should be obtained.
         */
        topic: z.string(),
    }),
    response: z.strictObject({
        /**
         * Whether the documentation could be obtained successfully.
         */
        success: z.boolean(),

        /**
         * Error message that occurred while trying to obtain the documentation, iff not successful.
         */
        error: z.string().optional(),

        /**
         * Markdown of the documentation that was obtained, iff successful.
         */
        markdown: z.string().optional(),
    }),
});

export type GetDocumentationDefinition = ApiDefinition<typeof kGetDocumentationDefinition>;

type Request = ApiRequest<typeof kGetDocumentationDefinition>;
type Response = ApiResponse<typeof kGetDocumentationDefinition>;

/**
 * Read-only version of documentation topics. We require the user to be signed in, but otherwise
 * we don't do any particular access checks to access documentation.
 */
export async function getDocumentation(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, { check: 'admin' });

    if (!props.user)
        unauthorized();  // not reachable

    const content = await getStaticContent([ 'documentation', request.topic ], {
        // Documentation can include substitutions to contextualise it to the signed in user. The
        // following values are available:
        firstName: props.user.firstName,
        name: props.user.name,
    });

    if (!content) {
        return {
            success: false,
            error: `No documentation has been written yet (documentation/${request.topic})`
        };
    }

    return { success: true, markdown: content.markdown };
}
