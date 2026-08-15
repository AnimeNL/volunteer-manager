// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { LogBuilder } from '@lib/log/index';
import { Publish, kSubscriptionType } from '@lib/subscriptions';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { createAccount, isUsernameAvailable } from '@lib/auth/Authentication';
import { getStaticContent } from '@lib/Content';
import { sealRegistrationRequest } from '@lib/auth/RegistrationRequest';

/**
 * Interface definition for the Register API, exposed through /api/auth/register.
 */
export const kRegisterDefinition = z.object({
    request: z.object({
        /**
         * The username of the account that should be created.
         */
        username: z.string().email(),

        /**
         * The password associated with that account, SHA256 hashed.
         */
        password: z.string().length(64),

        /**
         * The user's first name.
         */
        firstName: z.string(),

        /**
         * The user's last name.
         */
        lastName: z.string(),

        /**
         * Gender of the user. A string because we don't care.
         */
        gender: z.string(),

        /**
         * Date on which the user was born. (YYYY-MM-DD)
         */
        birthdate: z.string().regex(/^[1|2](\d{3})\-(\d{2})-(\d{2})$/),

        /**
         * Phone number of the user, in an undefined format.
         */
        phoneNumber: z.string(),

        /**
         * Discord handle owned by the user, when provided, in an undefined format.
         */
        discordHandle: z.string().optional(),

        /**
         * Whether the user has accepted the terms of our privacy policy.
         * TODO: s/optional// when moving this to a Server Action
         */
        gdpr: z.boolean().optional(),

        /**
         * Optional URL to which the user should be redirected after they confirm their e-mail
         * address. This often happens in a new tab, so we want to kick them back in a flow.
         */
        redirectUrl: z.string().optional(),
    }),

    response: z.strictObject({
        /**
         * Whether the registration attempt was successful.
         */
        success: z.boolean(),

        /**
         * The error message that occurred when `success` is not set to true.
         */
        error: z.string().optional(),
    }),
});

export type RegisterDefinition = ApiDefinition<typeof kRegisterDefinition>;

type Request = ApiRequest<typeof kRegisterDefinition>;
type Response = ApiResponse<typeof kRegisterDefinition>;

/**
 * API that allows accounts to be created. The `request` includes all the necessary information,
 * whereas the implementation will do the necessary checks to make sure it's valid.
 */
export async function register(request: Request, props: ActionProps): Promise<Response> {
    const available = await isUsernameAvailable(request.username);
    if (!available)
        return { success: false, error: 'There already is an account with that username.' };

    if (!request.gdpr)
        return { success: false, error: 'You must accept our GDPR & privacy policies.' };

    const userId = await createAccount({
        username: request.username,
        password: request.password,
        firstName: request.firstName,
        lastName: request.lastName,
        gender: request.gender,
        birthdate: request.birthdate,
        phoneNumber: request.phoneNumber,
        discordHandle: request.discordHandle,
    });

    if (!userId)
        return { success: false, error: 'The server was unable to create an account.' };

    const sender = 'AnimeCon Volunteering Teams';
    const registrationRequest = await sealRegistrationRequest({
        id: userId,
        redirectUrl: request.redirectUrl,
    });

    // Send an e-mail to the user containing their registration verification link.
    const messageContent = await getStaticContent([ 'message', 'registration' ], {
        substitutions: {
            link: `https://${props.origin}/?registration-request=${registrationRequest}`,
            name: request.firstName,
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
                markdown: messageContent.content,
            },
            attribution: {
                sourceUserId: userId,
                targetUserId: userId,
            },
        });
    }

    await Publish({
        type: kSubscriptionType.Registration,
        sourceUserId: userId,
        message: {
            userId,
            name: `${request.firstName} ${request.lastName}`,
            emailAddress: request.username,
            ip: props.ip || 'unknown',
        },
    });

    LogBuilder.for('AccountRegister')
        .withInitiatorUser(userId)
        .record();

    return { success: true };
}
