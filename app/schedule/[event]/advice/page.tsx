// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';

import type { NextPageParams } from '@lib/NextRouterParams';
import { AdviceContainer } from './AdviceContainer';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <AdvicePage> component describes the page that's able to generate personalised advice for the
 * volunteer, based on the latest piece of Del a Rie Advice and the volunteer's circumstances. The
 * advice will be fetched from the server, where it may be cached for a period of time.
 */
export default async function AdvicePage(props: NextPageParams<'event'>) {
    const params = await props.params;
    await requireAuthenticationContext({ check: 'event', event: params.event });

    return (
        <>
            <HeaderSectionCard>
                <Box sx={{
                    backgroundImage: 'url(/images/del-a-rie-advies-personalised.jpg?2025)',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 3.5 }} />
            </HeaderSectionCard>
            <AdviceContainer />
        </>
    );
}
