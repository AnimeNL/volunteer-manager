// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { Suspense } from 'react';

import AttractionsIcon from '@mui/icons-material/Attractions';

import { AnimeConStreamingApiPlaceholder } from './AnimeConStreamingApiPlaceholder';
import { AnimeConStreamingApiResult } from './AnimeConStreamingApiResult';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * The AnimeCon integration page is able to issue various API calls for illustrative debugging
 * purposes. The API call responses are displayed in text areas for manual consumption.
 */
export default async function AnimeConIntegrationPage() {
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
            <Section title="API" subtitle="activities.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult endpoint="activities.json" />
                </Suspense>
            </Section>
            <Section title="API" subtitle="activity-types.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult endpoint="activity-types.json" />
                </Suspense>
            </Section>
            <Section title="API" subtitle="floors.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult endpoint="floors.json" />
                </Suspense>
            </Section>
            <Section title="API" subtitle="timeslots.json">
                <Suspense fallback={ <AnimeConStreamingApiPlaceholder /> }>
                    <AnimeConStreamingApiResult endpoint="timeslots.json" />
                </Suspense>
            </Section>
        </>
    );
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'AnimeCon integration | AnimeCon Volunteer Manager',
};
