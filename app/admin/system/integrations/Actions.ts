// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod';

import { LogBuilder } from '@lib/log/index';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { writeSettings } from '@lib/Settings';

import { kTwilioRegion } from '@lib/integrations/twilio/TwilioTypes';

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
    Email: z.object({
        hostname: z.string().nonempty(),
        port: z.coerce.number(),
        username: z.string().nonempty(),
        password: z.string().nonempty(),
    }).optional(),
    Google: z.object({
        apiKey: z.string().nonempty(),
        credential: z.string().nonempty(),
        location: z.string().nonempty(),
        projectId: z.string().nonempty(),
    }).optional(),
    Twilio: z.object({
        accountSid: z.string().nonempty(),
        accountAuthToken: z.string().nonempty(),
        messagingSidSms: z.string().nonempty(),
        messagingSidWhatsapp: z.string().nonempty(),
        region: z.enum(kTwilioRegion),
    }).optional(),
    Weeztix: z.object({
        clientId: z.string().nonempty(),
        clientSecret: z.string().nonempty(),
        redirectUrl: z.string().nonempty(),
    }).optional(),
    YourTicketProvider: z.object({
        apiKey: z.string().nonempty(),
        endpoint: z.url(),
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

            case 'Email':
                await writeSettings({
                    'integration-email-smtp-hostname': data.Email!.hostname,
                    'integration-email-smtp-port': data.Email!.port,
                    'integration-email-smtp-username': data.Email!.username,
                    'integration-email-smtp-password': data.Email!.password,
                });

                break;

            case 'Google':
                await writeSettings({
                    'integration-google-apikey': data.Google!.apiKey,
                    'integration-google-credentials': data.Google!.credential,
                    'integration-google-location': data.Google!.location,
                    'integration-google-project-id': data.Google!.projectId,
                });

                break;

            case 'Twilio':
                await writeSettings({
                    'integration-twilio-account-auth-token': data.Twilio!.accountAuthToken,
                    'integration-twilio-account-sid': data.Twilio!.accountSid,
                    'integration-twilio-messaging-sid-sms': data.Twilio!.messagingSidSms,
                    'integration-twilio-messaging-sid-whatsapp': data.Twilio!.messagingSidWhatsapp,
                    'integration-twilio-region': data.Twilio!.region,
                });

                break;

            case 'Weeztix':
                await writeSettings({
                    'integration-weeztix-client-id': data.Weeztix!.clientId,
                    'integration-weeztix-client-secret': data.Weeztix!.clientSecret,
                    'integration-weeztix-redirect-url': data.Weeztix!.redirectUrl,
                });

                break;

            case 'YourTicketProvider':
                await writeSettings({
                    'integration-ytp-api-key': data.YourTicketProvider!.apiKey,
                    'integration-ytp-endpoint': data.YourTicketProvider!.endpoint,
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
