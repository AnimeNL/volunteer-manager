// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { writeSettings } from '@lib/Settings';

import { kTwilioRegion } from '@lib/integrations/twilio/TwilioTypes';

/**
 * Interface definition for the Update Integration API, exposed through
 * /api/admin/update-integration.
 */
export const kUpdateIntegrationDefinition = z.object({
    request: z.object({
        /**
         * AnimeCon API settings that should be updated.
         */
        animecon: z.object({
            apiEndpoint: z.string(),
            authEndpoint: z.string(),
            clientId: z.string(),
            clientSecret: z.string(),
            username: z.string(),
            password: z.string(),
            scopes: z.string(),
        }).optional(),

        /**
         * E-mail settings that should be updated.
         */
        email: z.object({
            hostname: z.string(),
            port: z.number(),
            username: z.string(),
            password: z.string(),
        }).optional(),

        /**
         * Google settings that should be updated.
         */
        google: z.object({
            apiKey: z.string(),
            credential: z.string(),
            location: z.string(),
            projectId: z.string(),
        }).optional(),

        /**
         * Twilio API settings that should be updated.
         */
        twilio: z.object({
            accountAuthToken: z.string(),
            accountSid: z.string(),
            messagingSidSms: z.string(),
            messagingSidWhatsapp: z.string(),
            region: z.enum(kTwilioRegion),
        }).optional(),

        /**
         * YourTicketProvider settings that should be updated.
         */
        yourTicketProvider: z.object({
            apiKey: z.string(),
            endpoint: z.string(),
        }).optional(),
    }),
    response: z.strictObject({
        /**
         * Whether the integration settings were updated successfully.
         */
        success: z.boolean(),
    }),
});

export type UpdateIntegrationDefinition = ApiDefinition<typeof kUpdateIntegrationDefinition>;

type Request = ApiRequest<typeof kUpdateIntegrationDefinition>;
type Response = ApiResponse<typeof kUpdateIntegrationDefinition>;

/**
 * API that allows the settings regarding a particular integration to be updated. The server call
 * allows for any number of integrations to be dealt with at once, and they can be gated behind
 * different permission levels if need be.
 */
export async function updateIntegration(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin',
        permission: 'system.internals.settings',
    });

    if (request.animecon) {
        await writeSettings({
            'integration-animecon-api-endpoint': request.animecon.apiEndpoint,
            'integration-animecon-auth-endpoint': request.animecon.authEndpoint,
            'integration-animecon-client-id': request.animecon.clientId,
            'integration-animecon-client-secret': request.animecon.clientSecret,
            'integration-animecon-username': request.animecon.username,
            'integration-animecon-password': request.animecon.password,
            'integration-animecon-scopes': request.animecon.scopes,
        });

        RecordLog({
            type: kLogType.AdminUpdateIntegration,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                integration: 'AnimeCon',
            }
        });
    }

    if (request.email) {
        await writeSettings({
            'integration-email-smtp-hostname': request.email.hostname,
            'integration-email-smtp-port': request.email.port,
            'integration-email-smtp-username': request.email.username,
            'integration-email-smtp-password': request.email.password,
        });

        RecordLog({
            type: kLogType.AdminUpdateIntegration,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                integration: 'e-mail',
            }
        });
    }

    if (request.google) {
        await writeSettings({
            'integration-google-apikey': request.google.apiKey,
            'integration-google-credentials': request.google.credential,
            'integration-google-location': request.google.location,
            'integration-google-project-id': request.google.projectId,
        });

        RecordLog({
            type: kLogType.AdminUpdateIntegration,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                integration: 'Google',
            }
        });
    }

    if (request.twilio) {
        await writeSettings({
            'integration-twilio-account-auth-token': request.twilio.accountAuthToken,
            'integration-twilio-account-sid': request.twilio.accountSid,
            'integration-twilio-messaging-sid-sms': request.twilio.messagingSidSms,
            'integration-twilio-messaging-sid-whatsapp': request.twilio.messagingSidWhatsapp,
            'integration-twilio-region': request.twilio.region,
        });

        RecordLog({
            type: kLogType.AdminUpdateIntegration,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                integration: 'Twilio',
            }
        });
    }

    if (request.yourTicketProvider) {
        await writeSettings({
            'integration-ytp-api-key': request.yourTicketProvider.apiKey,
            'integration-ytp-endpoint': request.yourTicketProvider.endpoint,
        });

        RecordLog({
            type: kLogType.AdminUpdateIntegration,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                integration: 'YourTicketProvider',
            }
        });
    }

    return { success: true };
}
