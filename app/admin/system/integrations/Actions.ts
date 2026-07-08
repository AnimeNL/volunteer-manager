// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod';

import { LogBuilder } from '@lib/log/index';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { writeSettings } from '@lib/Settings';

/**
 * Server Action scheme for updating integration settings.
 */
const kIntegrationSettingsData = z.object({
    AnimeCon: z.object({
        apiEndpoint: z.url(),
        authEndpoint: z.url(),
        clientId: z.string().nonempty(),
        clientSecret: z.string().nonempty(),
        username: z.string().nonempty(),
        password: z.string().nonempty(),
        scopes: z.string().nonempty(),
    }).optional(),
});

/**
 * Integrations for which settings and health checks are expected to be available.
 */
type Integration = keyof z.infer<typeof kIntegrationSettingsData>;

/**
 * Server Action through which the settings for an integration can be updated.
 */
export async function updateIntegration(integration: Integration, formData: unknown) {
    return executeServerAction(formData, kIntegrationSettingsData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, { check: 'admin', permission: 'root' });
        if (typeof data[integration] === 'undefined')
            notFound();

        switch (integration) {
            case 'AnimeCon':
                await writeSettings({
                    'integration-animecon-api-endpoint': data.AnimeCon!.apiEndpoint,
                    'integration-animecon-auth-endpoint': data.AnimeCon!.authEndpoint,
                    'integration-animecon-client-id': data.AnimeCon!.clientId,
                    'integration-animecon-client-secret': data.AnimeCon!.clientSecret,
                    'integration-animecon-username': data.AnimeCon!.username,
                    'integration-animecon-password': data.AnimeCon!.password,
                    'integration-animecon-scopes': data.AnimeCon!.scopes,
                });

                break;
        }

        LogBuilder.for('UpdateIntegrationSettings')
            .withInitiatorUser(props.user)
            .withSeverity('Debug')
            .record({ integration });

        return { success: true };
    });
}

/**
 * Server Action through which a health check for the given `integration` can be executed.
 */
export async function executeHealthCheck(integration: Integration) {
    return executeServerAction({ /* none */ }, z.object({ /* none */ }), async (data, props) => {
        executeAccessCheck(props.authenticationContext, { check: 'admin', permission: 'root' });

    });
}
