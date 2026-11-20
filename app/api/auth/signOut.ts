// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { authenticateUser } from '@lib/auth/Authentication';
import { createUserSession, revokeUserSession, verifyUserSession } from '@lib/auth/SessionStore';
import { getSessionFromHeaders } from '@lib/auth/getSession';
import {
    isPersistentSessionData,
    writeEmptySessionCookie,
    writeSealedSessionCookie,
} from '@lib/auth/Session';

/**
 * Interface definition for the SignOut API, exposed through /api/auth/sign-out.
 */
export const kSignOutDefinition = z.object({
    request: z.object({ /* no request parameters */ }),
    response: z.strictObject({
        /**
         * Whether the sign out operation could be completed successfully.
         */
        success: z.boolean(),

        /**
         * URL the user should be forwarded to when the sign out operation was successful.
         */
        returnUrl: z.string().optional(),
    }),
});

export type SignOutDefinition = ApiDefinition<typeof kSignOutDefinition>;

type Request = ApiRequest<typeof kSignOutDefinition>;
type Response = ApiResponse<typeof kSignOutDefinition>;

/**
 * API that signs the user out of their account by setting an empty authentication session cookie
 * that's due to expire right after receiving it. No verification is done in this method.
 */
export async function signOut(request: Request, props: ActionProps): Promise<Response> {
    const session = await getSessionFromHeaders(props.requestHeaders);
    if (session && isPersistentSessionData(session)) {
        const verified = await verifyUserSession(session.sessionId, session.secret);
        await revokeUserSession(session.sessionId, session.userId);

        if (verified?.impersonatorUserId) {
            const { user } = await authenticateUser({
                type: 'userId',
                userId: verified.impersonatorUserId,
            });

            if (user) {
                const restored = await createUserSession({ userId: user.id });
                await writeSealedSessionCookie(restored, props.responseHeaders);
                return { success: true, returnUrl: verified.impersonatorReturnUrl };
            }
        }

        await writeEmptySessionCookie(props.responseHeaders);
        return { success: true };
    }

    if (session && !isPersistentSessionData(session) && session.parent) {
        await writeSealedSessionCookie(session.parent, props.responseHeaders);
        return { success: true, returnUrl: session.parent.returnUrl };
    }

    await writeEmptySessionCookie(props.responseHeaders);
    return { success: true };
}
