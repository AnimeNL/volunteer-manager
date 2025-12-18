// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';

import { AdviceContainer } from './AdviceContainer';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { SetTitle } from '../components/SetTitle';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kThemeImageVersion } from '@app/config';

/**
 * The <AdvicePage> component describes the page that's able to generate personalised advice for the
 * volunteer, based on the latest piece of Del a Rie Advice and the volunteer's circumstances. The
 * advice will be fetched from the server, where it may be cached for a period of time.
 */
export default async function AdvicePage(props: PageProps<'/schedule/[event]/advice'>) {
    const params = await props.params;
    await requireAuthenticationContext({ check: 'event', event: params.event });

    return (
        <>
            <SetTitle title="Del a Rie Advies" />
            <HeaderSectionCard>
                <Box sx={{
                    backgroundImage:
                        'url(/images/theme/del-a-rie-advies-personalised.jpg?' +
                        `${kThemeImageVersion})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 3.5 }} />
            </HeaderSectionCard>
            <AdviceContainer />
        </>
    );
}
