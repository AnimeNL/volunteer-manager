// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordErrorLog, RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { authenticateUser, getUserSessionToken } from '@lib/auth/Authentication';
import { determineEnvironment } from '@lib/Environment';
import { getEventsForUser } from '@lib/EventLoader';
import { unsealRegistrationRequest } from '@lib/auth/RegistrationRequest';
import { writeSealedSessionCookie } from '@lib/auth/Session';
import db, { tUsers } from '@lib/database';

/**
 * Interface definition for the RegisterActivate API, exposed through /api/auth/register-activate.
 */
export const kRegisterActivateDefinition = z.object({
    request: z.object({
        /**
         * The registration request for which the account should be activated.
         */
        registrationRequest: z.string(),
    }),

    response: z.strictObject({
        /**
         * Whether the account was activated successfully. When set to `true`, the authentication
         * cookie will be set automatically for the user as well.
         */
        success: z.boolean(),

        /**
         * When successful, the user's first name is included to personalize the interface.
         */
        firstName: z.string().optional(),

        /**
         * When successful, the name of the team to which the volunteer applied.
         */
        teamName: z.string().optional(),

        /**
         * When successful and available, the URL the user should be redirected to after activation.
         */
        redirectUrl: z.string().optional(),
    }),
});

export type RegisterActivateDefinition = ApiDefinition<typeof kRegisterActivateDefinition>;

type Request = ApiRequest<typeof kRegisterActivateDefinition>;
type Response = ApiResponse<typeof kRegisterActivateDefinition>;

/**
 * This API enables the client to confirm their registration attempt. Typically the registration
 * token will be send to them by e-mail, after which they end up back on the volunteer manager.
 */
export async function registerActivate(request: Request, props: ActionProps): Promise<Response> {
    const registrationRequest = await unsealRegistrationRequest(request.registrationRequest);
    if (!registrationRequest)
        return { success: false };  // invalid or expired registration request

    const environment = await determineEnvironment();
    if (!environment)
        return { success: false };  // invalid environment?

    const unactivatedUser = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(registrationRequest.id))
        .select({
            activated: tUsers.activated,
            sessionToken: tUsers.sessionToken,
        })
        .executeSelectNoneOrOne();

    if (!unactivatedUser || !!unactivatedUser.activated) {
        RecordErrorLog({
            error: new Error('Unable to identify the unactivated user account'),
            requestUrl: { pathname: '/api/auth/register-activate' },
            severity: kLogSeverity.Info,
            source: 'Server',
            user: props.user,
        });

        return { success: false };  // the account has already been activated
    }

    const affectedRows = await db.update(tUsers)
        .set({ activated: 1 })
        .where(tUsers.userId.equals(registrationRequest.id))
        .executeUpdate(/* min= */ 0, /* max= */ 1);

    if (!affectedRows)
        return { success: false };  // unable to update the user in the database?

    const { access, user } =
        await authenticateUser({ type: 'userId', userId: registrationRequest.id });
    const sessionToken = await getUserSessionToken(registrationRequest.id);

    if (!user || !sessionToken)
        return { success: false };  // the user must be disabled for another reason

    await writeSealedSessionCookie({ id: user.id, token: sessionToken }, props.responseHeaders);
    RecordLog({
        type: kLogType.AccountActivate,
        sourceUser: user,
        data: { ip: props.ip },
    });

    const availableEvents = await getEventsForUser(environment.domain, access, user);

    let applicationUrl: string | undefined;
    for (const availableEvent of availableEvents) {
        const eventEnvironmentData = availableEvent.getEnvironmentData(environment.domain);
        if (!eventEnvironmentData)
            continue;  // the current team does not participate in this event

        if (!eventEnvironmentData.enableApplications)
            continue;  // this event does not currently accept applications

        applicationUrl = `/registration/${availableEvent.slug}/application`;
    }

    return {
        success: true,
        firstName: user.firstName,
        teamName: environment.title,
        redirectUrl: applicationUrl ?? registrationRequest.redirectUrl,
    };
}
