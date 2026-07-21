// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { headers } from 'next/headers';

import Link from '@app/LinkProxy';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import ApiIcon from '@mui/icons-material/Api';
import AttractionsIcon from '@mui/icons-material/Attractions';
import Chip from '@mui/material/Chip';
import EmailIcon from '@mui/icons-material/Email';
import GoogleIcon from '@mui/icons-material/Google';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Temporal } from '@lib/Temporal';
import { TwilioLogo } from '../webhooks/twilio/[id]/TwilioLogo';
import { WeeztixAuthorizeButton } from './WeeztixAuthorizeButton';
import { WeeztixLogo } from './WeeztixLogo';
import { generateWeeztixState } from './weeztix-oauth/generateWeeztixState';
import { readSettings } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kTwilioRegion } from '@lib/integrations/twilio/TwilioTypes';

import { updateIntegration } from './Actions';

/**
 * Google endpoint locations that are available in the Volunteer Manager.
 * @see https://cloud.google.com/vertex-ai/docs/general/locations#europe
 */
const kGoogleLocationOptions = [
    { id: 'eu', label: 'Europe (multi-region)' },
    { id: 'europe-west2', label: 'London (europe-west2)' },
    { id: 'europe-west4', label: 'Amsterdam (europe-west4)' },
    { id: 'us', label: 'United States (multi-region)' },
    { id: 'us-central1', label: 'Iowa (us-central1)' },
    { id: 'us-west1', label: 'Oregon (us-west1)' },
];

/**
 * The Integrations page lists settings and information regarding the third party services that the
 * Volunteer Manager integrates with.
 */
export default async function IntegrationsPage() {
    const { user } = await requireAuthenticationContext({
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

        // Weeztix:
        'integration-weeztix-access-token',
        'integration-weeztix-client-id',
        'integration-weeztix-client-secret',
        'integration-weeztix-redirect-url',
        'integration-weeztix-refresh-token',
        'integration-weeztix-refresh-token-expiration',

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
        Email: {
            hostname: settings['integration-email-smtp-hostname'] ?? '',
            port: settings['integration-email-smtp-port'] ?? 587,
            username: settings['integration-email-smtp-username'] ?? '',
            password: settings['integration-email-smtp-password'] ?? '',
        },
        Google: {
            apiKey: settings['integration-google-apikey'] ?? '',
            credential: settings['integration-google-credentials'] ?? '',
            location: settings['integration-google-location'] ?? '',
            projectId: settings['integration-google-project-id'] ?? '',
        },
        Twilio: {
            accountSid: settings['integration-twilio-account-sid'] ?? '',
            accountAuthToken: settings['integration-twilio-account-auth-token'] ?? '',
            messagingSidSms: settings['integration-twilio-messaging-sid-sms'] ?? '',
            messagingSidWhatsapp: settings['integration-twilio-messaging-sid-whatsapp'] ?? '',
            region: settings['integration-twilio-region'],
        },
        Weeztix: {
            accessToken: settings['integration-weeztix-access-token'] ?? '',
            clientId: settings['integration-weeztix-client-id'] ?? '',
            clientSecret: settings['integration-weeztix-client-secret'] ?? '',
            redirectUrl: settings['integration-weeztix-redirect-url'] ??
                `https://${(await headers()).get('Host')}/admin/system/integrations/weeztix-oauth`,
            refreshToken: settings['integration-weeztix-refresh-token'] ?? '',
        },
        YourTicketProvider: {
            apiKey: settings['integration-ytp-api-key'] ?? '',
            endpoint: settings['integration-ytp-endpoint'] ?? '',
        },
    };

    let weeztixExpirationWarning: React.ReactNode;

    const weeztixExpiration = settings['integration-weeztix-refresh-token-expiration'];
    if (!!weeztixExpiration) {
        const currentZonedDateTime = Temporal.Now.zonedDateTimeISO('UTC');

        const expirationInstant = Temporal.Instant.fromEpochMilliseconds(weeztixExpiration);
        const expirationZonedDateTime = expirationInstant.toZonedDateTimeISO('UTC');

        const daysRemaining = currentZonedDateTime.until(expirationZonedDateTime, {
            largestUnit: 'days',
        }).days;

        if (daysRemaining <= 0) {
            weeztixExpirationWarning = (
                <Chip label="expired" color="error" variant="outlined" size="small" />
            );
        } else if (daysRemaining < /* ~one month= */ 31) {
            weeztixExpirationWarning = (
                <Chip label={`T-${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}
                      color="warning" variant="outlined" size="small" />
            );
        }
    }

    const weeztixState = await generateWeeztixState(user.id);

    const twilioRegions = Object.values(kTwilioRegion).map(region => ({
        id: region,
        label: region,
    }));

    return (
        <>
            <Section icon={ <ApiIcon color="primary" /> } title="Integrations"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations' },
                     ]}>
                <SectionIntroduction>
                    The Volunteer Manager integrates with various external services to provide
                    advanced automisations.
                </SectionIntroduction>
            </Section>

            { /* ****************************************************************************** */ }

            <FormGridSection action={ updateIntegration.bind(null, 'AnimeCon') }
                             defaultValues={{ AnimeCon: defaultValues['AnimeCon']}}
                             title="AnimeCon API" icon={ <AttractionsIcon /> }
                             headerAction={
                                 <IconButton LinkComponent={Link} size="small"
                                             href="/admin/system/integrations/animecon">
                                     <ReadMoreIcon color="primary" />
                                 </IconButton>
                             }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        Event and program information is obtained through the{' '}
                        <MuiLink component={Link} href="https://github.com/AnimeNL/rest-api">
                             AnimeCon API
                        </MuiLink>,
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
                    <TextFieldElement name="AnimeCon[scopes]" label="Scopes" fullWidth required
                                      size="small" />
                </Grid>
            </FormGridSection>

            { /* ****************************************************************************** */ }

            <FormGridSection action={ updateIntegration.bind(null, 'Email') }
                             defaultValues={{ Email: defaultValues['Email'] }}
                             title="E-mail" icon={ <EmailIcon /> }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        The SMTP server and authentication details used to send e-mails from the manager.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Email[hostname]" label="Hostname" fullWidth required
                                      size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Email[port]" label="Port" fullWidth required
                                      size="small" type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Email[username]" label="Username" fullWidth required
                                      size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Email[password]" label="Password" type="password"
                                      size="small" required fullWidth />
                </Grid>
            </FormGridSection>

            { /* ****************************************************************************** */ }

            <FormGridSection action={ updateIntegration.bind(null, 'Google') }
                             defaultValues={{ Google: defaultValues['Google'] }}
                             title="Google" icon={ <GoogleIcon /> }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        The service account provides access to both data on Drive and to Google's API
                        offering, such as the Vertex AI APIs.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Google[apiKey]" label="API Key" fullWidth required
                                      size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Google[credential]" label="Credential" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="Google[location]" label="Location" fullWidth required
                                   options={kGoogleLocationOptions} size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Google[projectId]" label="Project ID" fullWidth
                                      size="small" required />
                </Grid>
            </FormGridSection>

            { /* ****************************************************************************** */ }

            <FormGridSection action={ updateIntegration.bind(null, 'Twilio') }
                             defaultValues={{ Twilio: defaultValues['Twilio'] }}
                             title="Twilio" icon={ <TwilioLogo /> }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        Twilio is used to send SMS and WhatsApp messages to select volunteers.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Twilio[accountSid]" label="Account SID" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Twilio[accountAuthToken]" label="Auth token" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Twilio[messagingSidSms]" label="SMS SID" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Twilio[messagingSidWhatsapp]" label="WhatsApp SID" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <SelectElement name="Twilio[region]" label="Twilio region" fullWidth size="small"
                                   options={twilioRegions} required />
                </Grid>
            </FormGridSection>

            { /* ****************************************************************************** */ }

            <FormGridSection action={ updateIntegration.bind(null, 'Weeztix') }
                             headerAction={
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    {weeztixExpirationWarning}
                                    <WeeztixAuthorizeButton settings={defaultValues['Weeztix']}
                                                            state={weeztixState} />
                                </Stack>
                             }
                             defaultValues={{
                                 Weeztix: defaultValues['Weeztix']
                             }}
                             title="Weeztix" icon={ <WeeztixLogo /> }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        API integration with the{' '}
                        <MuiLink component={Link} href="https://weeztix.com/">
                            Weeztix API
                        </MuiLink>, which AnimeCon uses for ticketing purposes.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Weeztix[clientId]" label="Client ID" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Weeztix[clientSecret]" label="Client secret" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="Weeztix[redirectUrl]" label="Redirect URL"
                                      fullWidth required size="small" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Weeztix[accessToken]" label="Access token" fullWidth
                                      size="small" slotProps={{ input: { disabled: true } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="Weeztix[refreshToken]" label="Refresh token" fullWidth
                                      size="small"  slotProps={{ input: { disabled: true } }} />
                </Grid>
            </FormGridSection>

            { /* ****************************************************************************** */ }

            <FormGridSection action={ updateIntegration.bind(null, 'YourTicketProvider') }
                             defaultValues={{
                                 YourTicketProvider: defaultValues['YourTicketProvider']
                             }}
                             title="YourTicketProvider" icon={ <LocalActivityIcon /> }>
                <Grid size={{ xs: 12 }}>
                    <Typography variant="body2">
                        API integration with the{' '}
                        <MuiLink component={Link} href="https://www.yourticketprovider.nl/">
                            YourTicketProvider API
                        </MuiLink>, which AnimeCon used to use for ticketing purposes.
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="YourTicketProvider[apiKey]" label="API Key" fullWidth
                                      size="small" required />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="YourTicketProvider[endpoint]" label="Endpoint" fullWidth
                                      size="small" required />
                </Grid>
            </FormGridSection>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Integrations | AnimeCon Volunteer Manager',
};
