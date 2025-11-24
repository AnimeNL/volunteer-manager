// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import type { TaskResult } from '@lib/database/Types';
import type { User } from '@lib/auth/User';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { createAnimeConClient } from '@lib/integrations/animecon';
import { createYourTicketProviderClient } from '@lib/integrations/yourticketprovider';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tTasks } from '@lib/database';

import { kTaskResult } from '@lib/database/Types';

/**
 * The services for which health check can be carried out.
 */
const ServiceEnumeration = z.enum([
    'AnimeCon',
    'Email',
    'Google',
    'YourTicketProvider'
]);

/**
 * Interface definition for the Integration API, exposed through /api/admin/service-health.
 */
export const kServiceHealthDefinition = z.object({
    request: z.object({
        /**
         * The service for which its health should be confirmed.
         */
        service: ServiceEnumeration,
    }),
    response: z.strictObject({
        /**
         * The service for which a health check was carried out.
         */
        service: ServiceEnumeration,

        /**
         * Whether the API call was able to execute successfully.
         */
        status: z.enum([ 'success', 'warning', 'error' ]),

        /**
         * Message that should accompany the service health check result.
         */
        message: z.string().optional(),
    }),
});

export type ServiceHealthDefinition = ApiDefinition<typeof kServiceHealthDefinition>;

type Request = ApiRequest<typeof kServiceHealthDefinition>;
type Response = ApiResponse<typeof kServiceHealthDefinition>;

/**
 * Runs a health check for the AnimeCon integration.
 */
async function runAnimeConHealthCheck(): Promise<Response> {
    try {
        const client = await createAnimeConClient();

        const activityTypes = await client.getActivityTypes();
        if (!activityTypes.length)
            throw new Error('No activity types were returned.');

        return {
            status: 'success',
            service: 'AnimeCon',
            message: `The integration is functional (${activityTypes.length} activity types)`,
        };
    } catch (error: any) {
        return {
            status: 'error',
            service: 'AnimeCon',
            message: error.message,
        };
    }
}

/**
 * Runs a health check for the e-mail client integration.
 */
async function runEmailHealthCheck(user: User): Promise<Response> {
    try {
        const taskId = await SendEmailTask.Schedule({
            sender: 'AnimeCon Volunteer Manager',
            message: {
                to: user.username!,
                subject: 'Volunteer Manager integration test',
                markdown: 'Test message from the **AnimeCon Volunteer Manager**',
            },
            attribution: {
                sourceUserId: user.id,
                targetUserId: user.id,
            },
        });

        const kMaximumAttempts = 10;

        let taskResult: TaskResult | null = null;
        for (let attempt = 0; attempt < kMaximumAttempts; ++attempt) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            taskResult = await db.selectFrom(tTasks)
                .selectOneColumn(tTasks.taskInvocationResult)
                .where(tTasks.taskId.equals(taskId))
                .executeSelectNoneOrOne();

            if (taskResult)
                break;
        }

        if (taskResult === kTaskResult.TaskSuccess) {
            return {
                status: 'success',
                service: 'Email',
                message: 'The integration is functional (task executed successfully)',
            }
        } else if (!!taskResult) {
            throw new Error(`The SendEmailTask did not complete successfully ("${taskResult}")`);
        } else {
            throw new Error('The SendEmailTask has not finished executing yet');
        }
    } catch (error: any) {
        return {
            status: 'error',
            service: 'Email',
            message: error.message,
        };
    }
}

/**
 * Runs a health check for the Google integration.
 */
async function runGoogleHealthCheck(): Promise<Response> {
    return {
        status: 'warning',
        service: 'Google',
        message: 'Health check has not been implemented yet',
    };
}

/**
 * Runs a health check for the YourTicketProvider API integration.
 */
async function runYourTicketProviderHealthCheck(): Promise<Response> {
    try {
        const client = await createYourTicketProviderClient();
        const organisers = await client.getOrganisers();

        if (organisers.length > 0) {
            return {
                status: 'success',
                service: 'YourTicketProvider',
                message: `The integration is functional ("${organisers[0].Email}")`
            };
        }

        return {
            status: 'warning',
            service: 'YourTicketProvider',
            message: 'The integration may be functional (no organisers were found)',
        };

    } catch (error: any) {
        return {
            status: 'error',
            service: 'YourTicketProvider',
            message: error.message,
        };
    }
}

/**
 * API that allows the health of our integrations to be checked. One request will be fired off for
 * each integration that we support.
 */
export async function serviceHealth(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin',
        permission: 'system.internals',
    });

    switch (request.service) {
        case 'AnimeCon':
            return runAnimeConHealthCheck();
        case 'Email':
            return runEmailHealthCheck(props.user!);
        case 'Google':
            return runGoogleHealthCheck();
        case 'YourTicketProvider':
            return runYourTicketProviderHealthCheck();
    }
}
