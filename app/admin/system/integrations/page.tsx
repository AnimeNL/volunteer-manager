// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Link from '@app/LinkProxy';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import Typography from '@mui/material/Typography';

import type { TwilioSettings } from '@lib/integrations/twilio/TwilioClient';
import type { YourTicketProviderClientSettings } from '@lib/integrations/yourticketprovider/YourTicketProviderClient';
import { Email, type EmailSettings } from './Email';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Google, type GoogleSettings } from './Google';
import { StatusHeader } from './StatusHeader';
import { Twilio } from './Twilio';
import { YourTicketProvider } from './YourTicketProvider';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { updateIntegration } from './Actions';

/**
 * The Integrations page lists settings and information regarding the third party services that the
 * Volunteer Manager integrates with.
 */
export default async function IntegrationsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.settings',
    });

    const settings = await readSettings([
        // AnimeCon:
        'integration-animecon-api-endpoint',
        'integration-animecon-auth-endpoint',
        'integration-animecon-client-id',
        'integration-animecon-client-secret',
        'integration-animecon-username',
        'integration-animecon-password',
        'integration-animecon-scopes',

        // E-mail:
        'integration-email-smtp-hostname',
        'integration-email-smtp-port',
        'integration-email-smtp-username',
        'integration-email-smtp-password',

        // Google:
        'integration-google-apikey',
        'integration-google-credentials',
        'integration-google-location',
        'integration-google-project-id',

        // Twilio:
        'integration-twilio-account-auth-token',
        'integration-twilio-account-sid',
        'integration-twilio-messaging-sid-sms',
        'integration-twilio-messaging-sid-whatsapp',
        'integration-twilio-region',

        // YourTicketProvider:
        'integration-ytp-api-key',
        'integration-ytp-endpoint',
    ]);

    const defaultValues = {
        AnimeCon: {
            apiEndpoint: settings['integration-animecon-api-endpoint'],
            authEndpoint: settings['integration-animecon-auth-endpoint'],
            clientId: settings['integration-animecon-client-id'],
            clientSecret: settings['integration-animecon-client-secret'],
            username: settings['integration-animecon-username'],
            password: settings['integration-animecon-password'],
            scopes: settings['integration-animecon-scopes'],
        },
    };

    const emailSettings: EmailSettings = {
        hostname: settings['integration-email-smtp-hostname'] ?? '',
        port: settings['integration-email-smtp-port'] ?? 587,
        username: settings['integration-email-smtp-username'] ?? '',
        password: settings['integration-email-smtp-password'] ?? '',
    };

    const googleSettings: GoogleSettings = {
        apiKey: settings['integration-google-apikey'] ?? '',
        credential: settings['integration-google-credentials'] ?? '',
        location: settings['integration-google-location'] ?? '',
        projectId: settings['integration-google-project-id'] ?? '',
    };

    const twilioSettings: TwilioSettings = {
        accountSid: settings['integration-twilio-account-sid'] ?? '',
        accountAuthToken: settings['integration-twilio-account-auth-token'] ?? '',
        messagingSidSms: settings['integration-twilio-messaging-sid-sms'] ?? '',
        messagingSidWhatsapp: settings['integration-twilio-messaging-sid-whatsapp'] ?? '',
        region: settings['integration-twilio-region'],
    };

    const yourTicketProviderSettings: YourTicketProviderClientSettings = {
        apiKey: settings['integration-ytp-api-key'] ?? '',
        endpoint: settings['integration-ytp-endpoint'] ?? '',
    };

    return (
        <>
            <StatusHeader />
            <FormGridSection action={ updateIntegration.bind(null, 'AnimeCon') }
                             defaultValues={{ AnimeCon: defaultValues['AnimeCon']}}
                             title="AnimeCon API"
                             headerAction={
                                 <IconButton LinkComponent={Link} size="small"
                                             href="/admin/system/integrations/animecon">
                                     <ReadMoreIcon color="primary" />
                                 </IconButton>
                             }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        Event and program information is obtained through the AnimeCon API (
                        <MuiLink component={Link} href="https://github.com/AnimeNL/rest-api">source</MuiLink>),
                        for which we identify using a service account.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="AnimeCon[apiEndpoint]" label="API endpoint" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="AnimeCon[authEndpoint]" label="Authentication endpoint"
                                      fullWidth size="small" required />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="AnimeCon[clientId]" label="Client ID" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="AnimeCon[clientSecret]" label="Client Secret" fullWidth
                                      size="small" required />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="AnimeCon[username]" label="Username" fullWidth required
                                      size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="AnimeCon[password]" label="Password" type="password"
                                      size="small" fullWidth required />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="AnimeCon[scopes" label="Scopes" fullWidth required
                                      size="small" />
                </Grid>
            </FormGridSection>
            <Email settings={emailSettings} />
            <Google settings={googleSettings} />
            <Twilio settings={twilioSettings} />
            <YourTicketProvider settings={yourTicketProviderSettings} />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Integrations | AnimeCon Volunteer Manager',
};
