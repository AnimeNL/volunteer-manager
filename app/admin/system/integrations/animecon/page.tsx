// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import ApiIcon from '@mui/icons-material/Api';
import AttractionsIcon from '@mui/icons-material/Attractions';

import { AnimeConStreamingApiPlaceholder } from './AnimeConStreamingApiPlaceholder';
import { AnimeConStreamingApiResult } from './AnimeConStreamingApiResult';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createAnimeConClient } from '@lib/integrations/animecon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The AnimeCon integration page is able to issue various API calls for illustrative debugging
 * purposes. The API call responses are displayed in text areas for manual consumption.
 */
export default async function AnimeConIntegrationPage() {
    const { user } = await requireAuthentication('system.integrations');

    const client = await createAnimeConClient({ userId: user.id });
    return (
        <>
            <Section icon={ <AttractionsIcon color="primary" /> } title="AnimeCon API"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'AnimeCon API' },
                     ]}>
                <SectionIntroduction>
                    This page displays the results of the AnimeCon API calls. Responses will be
                    shown as they become available.
                </SectionIntroduction>
            </Section>
            <Section icon={ <ApiIcon /> } title="API" subtitle="activities.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult client={client} endpoint="activities.json" />
                </Suspense>
            </Section>
            <Section icon={ <ApiIcon /> } title="API" subtitle="activity-types.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult client={client} endpoint="activity-types.json" />
                </Suspense>
            </Section>
            <Section icon={ <ApiIcon /> } title="API" subtitle="floors.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult client={client} endpoint="floors.json" />
                </Suspense>
            </Section>
            <Section icon={ <ApiIcon /> } title="API" subtitle="timeslots.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult client={client} endpoint="timeslots.json" />
                </Suspense>
            </Section>
        </>
    );
}

export const dynamic = 'force-dynamic';

export const generateMetadata = createGenerateMetadataFn('AnimeCon API', 'Integrations', 'System');
