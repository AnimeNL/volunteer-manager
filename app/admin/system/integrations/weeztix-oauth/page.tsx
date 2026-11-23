// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { Suspense } from 'react';
import { notFound, unauthorized } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import Typography from '@mui/material/Typography';

import { Instrumentation } from '@lib/integrations/Instrumentation';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { type Setting, readSettings, writeSetting, writeSettings } from '@lib/Settings';
import { WeeztixIcon } from '@app/admin/components/icons/WeeztixIcon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { generateWeeztixState } from './generateWeeztixState';
import { requireAuthentication } from '@lib/auth';
import { createWeeztixClient } from '@lib/integrations/weeztix';

/**
 * Endpoint through which access tokens can be obtained.
 *
 * @todo Move this to the Weeztix integration once it exists.
 */
const kWeeztixTokensEndpoint = 'https://auth.weeztix.com/tokens';

/**
 * Zod scheme that the token response is expected to adhere to.
 */
const kWeeztixTokensScheme = z.object({
    token_type: z.literal('Bearer'),
    expires_in: z.number(),
    access_token: z.string().nonempty(),
    refresh_token: z.string().nonempty(),
    refresh_token_expires_in: z.number(),
});

/**
 * Page that the signed in user will be redirected to following a successful authentication with the
 * Weeztix API, for purposes of renewing our authentication tokens.
 */
export default async function WeeztixOAuthCallback(
    props: PageProps<'/admin/system/integrations/weeztix-oauth'>)
{
    const searchParams = await props.searchParams;

    const code = searchParams['code'];
    const state = searchParams['state'];

    if (!code || typeof code !== 'string' || !state)
        notFound();

    const { user } = await requireAuthentication('system.integrations');

    const expectedState = await generateWeeztixState(user.id);
    if (expectedState !== state)
        unauthorized();

    return (
        <>
            <Section icon={ <WeeztixIcon /> } title="Weeztix authorization"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'Weeztix authorization' },
                     ]}>
                <SectionIntroduction>
                    An authorization token has been received from Weeztix—attempting to complete
                    authorization for use of the API…
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <Suspense fallback={ <SectionLoading disablePadding /> }>
                    <Authorization code={code} userId={user.id} />
                </Suspense>
            </Section>
        </>
    );
}

/**
 * Component that completes the Weeztix authentication flow by requesting the initial token. When
 * successful, the access token and refresh token (with their TTLs) will be stored in settings.
 *
 * @see https://docs.weeztix.com/docs/introduction/authentication/request-token
 */
async function Authorization(props: { code: string; userId: number }) {
    const settings = await readSettings([
        'integration-weeztix-client-id',
        'integration-weeztix-client-secret',
        'integration-weeztix-redirect-url',
    ]);

    const requiredSettingMissing = Object.values(settings).some(value => !value);
    if (requiredSettingMissing) {
        return (
            <Alert severity="error" variant="outlined">
                The Weeztix client ID, secret or redirect URL have not been configured correctly.
            </Alert>
        );
    }

    // ---------------------------------------------------------------------------------------------
    // (1) Request a new token from the Weeztix server
    // ---------------------------------------------------------------------------------------------

    const instrumentation = Instrumentation.withContext({
        integration: 'Weeztix',
        operation: kWeeztixTokensEndpoint,
        userId: props.userId,
    });

    let response: Response;
    try {
        response = await instrumentation.instrumentedFetch(kWeeztixTokensEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: settings['integration-weeztix-client-id'],
                client_secret: settings['integration-weeztix-client-secret'],
                redirect_uri: settings['integration-weeztix-redirect-url'],
                code: props.code,
            }),
        });
    } catch (error: any) {
        return (
            <Alert severity="error" variant="outlined">
                Unable to request a token: {error.message}
            </Alert>
        );
    }

    // ---------------------------------------------------------------------------------------------
    // (2) Verify that the Weeztix server responded with a 2xx status code
    // ---------------------------------------------------------------------------------------------

    if (!response.ok) {
        return (
            <>
                <Alert severity="error" variant="outlined">
                    Unable to request a token, the Weeztix server rejected our request.
                </Alert>
                <Typography variant="body2" sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}>
                    { await response.text() }
                </Typography>
            </>
        );
    }

    // ---------------------------------------------------------------------------------------------
    // (3) Verify that the Weeztix server responded with the expected information
    // ---------------------------------------------------------------------------------------------

    let tokenInformation: z.infer<typeof kWeeztixTokensScheme>;
    try {
        tokenInformation = kWeeztixTokensScheme.parse(await response.json());
    } catch (error: any) {
        return (
            <>
                <Alert severity="error" variant="outlined">
                    Unable to request a token, the Weeztix server responded in an unexpected format.
                </Alert>
                <Typography variant="body2" sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}>
                    { error.toString() }
                </Typography>
            </>
        );
    }

    // ---------------------------------------------------------------------------------------------
    // (4) Store the newly received token in the database
    // ---------------------------------------------------------------------------------------------

    const accessToken = tokenInformation.access_token;
    const accessTokenExpiration = Temporal.Now.instant().add({
        seconds: tokenInformation.expires_in
    });

    const refreshToken = tokenInformation.refresh_token;
    const refreshTokenExpiration = Temporal.Now.instant().add({
        seconds: tokenInformation.refresh_token_expires_in
    });

    await writeSettings({
        'integration-weeztix-access-token': accessToken,
        'integration-weeztix-access-token-expiration': accessTokenExpiration.epochMilliseconds,
        'integration-weeztix-refresh-token': refreshToken,
        'integration-weeztix-refresh-token-expiration': refreshTokenExpiration.epochMilliseconds,
    });

    // ---------------------------------------------------------------------------------------------
    // (5) Fetch event information to auto-populate our Company ID
    // ---------------------------------------------------------------------------------------------

    try {
        const clientWithoutCompany = await createWeeztixClient(/* optionalMetadataFields= */ true);
        {
            const events = await clientWithoutCompany.listEvents();
            if (!events.length)
                throw new Error('Weeztix does not expose any events for these credentials.');

            await writeSetting('integration-weeztix-company-id', events[0].company_id);
        }

        const clientWithCompany = await createWeeztixClient(/* optionalMetadataFields= */ true);
        {
            const metadata = await clientWithCompany.listMetadata();
            const metadataMapping: { [k: string]: Setting } = {
                first_name: 'integration-weeztix-meta-first-name-id',
                function: 'integration-weeztix-meta-function-id',
                last_name: 'integration-weeztix-meta-last-name-id',
                nickname: 'integration-weeztix-meta-nickname-id',
                organisation: 'integration-weeztix-meta-organisation-id',
            };

            let matchedGuidCount = 0;
            for (const { guid, name } of metadata) {
                const normalisedName = name.trim().toLocaleLowerCase();
                if (!Object.hasOwn(metadataMapping, normalisedName))
                    continue;

                await writeSetting(metadataMapping[normalisedName], guid);
                matchedGuidCount++;
            }

            const expectedGuidCount = Object.keys(metadataMapping).length;
            if (matchedGuidCount !== expectedGuidCount)
                throw new Error(`Expected ${expectedGuidCount} GUIDs, found ${matchedGuidCount}`);
        }
    } catch (error: any) {
        console.error(error);
        return (
            <>
                <Alert severity="error" variant="outlined">
                    Unable to auto-populate our company ID and/or metadata fields.
                </Alert>
                <Typography variant="body2" sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}>
                    { error.toString() }
                </Typography>
            </>
        );
    }

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Alert severity="success" variant="outlined">
                Our Weeztix tokens have been refreshed, thank you!
            </Alert>
            <Button component={Link} href="/admin/system/integrations/" variant="outlined"
                    startIcon={ <NavigateBeforeIcon /> }>
                Back to integrations
            </Button>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Weeztix authorization', 'Integrations', 'System');
