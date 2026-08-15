// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { getStaticContent } from '@lib/Content';
import { sealPasswordResetRequest } from '@lib/auth/PasswordReset';
import db, { tUsers } from '@lib/database';

/**
 * Interface definition for the PasswordResetRequest API, exposed through
 * /api/auth/password-reset-request.
 */
export const kPasswordResetRequestDefinition = z.object({
    request: z.object({
        /**
         * The username for whom the password reset request should be issued.
         */
        username: z.string().email(),
    }),

    response: z.strictObject({
        /**
         * Whether an e-mail has been send to their address with a reset password link.
         */
        success: z.boolean(),
    }),
});

export type PasswordResetRequestDefinition = ApiDefinition<typeof kPasswordResetRequestDefinition>;

type Request = ApiRequest<typeof kPasswordResetRequestDefinition>;
type Response = ApiResponse<typeof kPasswordResetRequestDefinition>;

/**
 * This API enables the client to confirm whether an account exists with a particular username. When
 * this is the case, selected WebAuthn data will be included in the response to allow the user to
 * sign in without relying on their password.
 */
export async function passwordResetRequest(request: Request, props: ActionProps)
    : Promise<Response>
{
    const passwordResetData = await db.selectFrom(tUsers)
        .where(tUsers.username.equals(request.username))
        .select({
            userId: tUsers.userId,
            sessionToken: tUsers.sessionToken,
            firstName: tUsers.firstName,
        })
        .executeSelectNoneOrOne() ?? undefined;

    if (passwordResetData) {
        const passwordResetRequest = await sealPasswordResetRequest({
            id: passwordResetData.userId,
            token: passwordResetData.sessionToken,
        });

        const sender = 'AnimeCon Volunteering Teams';
        const messageContent = await getStaticContent([ 'message', 'lost-password' ], {
            disableJsx: true,
            substitutions: {
                link: `https://${props.origin}/?password-reset-request=${passwordResetRequest}`,
                name: passwordResetData.firstName,
                sender,
            },
        });

        if (messageContent) {
            await SendEmailTask.Schedule({
                // note: uses the default e-mail account
                sender,
                message: {
                    to: request.username,
                    subject: messageContent.title,
                    markdown: messageContent.markdown,
                },
                attribution: {
                    sourceUserId: passwordResetData.userId,
                    targetUserId: passwordResetData.userId,
                },
            });

            RecordLog({
                type: kLogType.AccountPasswordResetRequest,
                sourceUser: passwordResetData.userId,
                data: { ip: props.ip }
            });

            return { success: true };
        }

        console.error('Unable to send a password reset e-mail: cannot find the content.');
    }

    return { success: false };
}
