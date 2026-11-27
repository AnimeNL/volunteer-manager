// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Stack from '@mui/material/Stack';

import { DesktopNavigationList, VolunteerNavigationItems } from './DesktopNavigationList';
import { SidebarEventBanner } from './EventBanner';
import { getNavigationData } from '../lib/scheduleData';

/**
 * Props accepted by the <DesktopNavigation> component.
 */
interface DesktopNavigationProps {
    /**
     * Route params promise from the `[event]` layout, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;
}

/**
 * Sticky desktop sidebar navigation for the schedule App Shell, displaying the event banner above
 * the route-aware navigation list.
 */
export function DesktopNavigation(props: DesktopNavigationProps) {
    return (
        <Stack spacing={1.5} sx={{
            maxHeight: 'calc(100dvh - 24px)',
            overflowY: 'auto',
            position: 'sticky',
            top: 12,
        }}>
            <SidebarEventBanner params={props.params} />
            <DesktopNavigationList>
                <Suspense fallback={null}>
                    <AuthenticatedNavigationItems params={props.params} />
                </Suspense>
            </DesktopNavigationList>
        </Stack>
    );
}

/**
 * Streams volunteer-specific sidebar items behind `<Suspense>` using the shared request-cached
 * `getNavigationData()` loader.
 */
async function AuthenticatedNavigationItems(props: DesktopNavigationProps) {
    const { event } = await props.params;
    const data = await getNavigationData(event);

    return data ? <VolunteerNavigationItems data={data} /> : null;
}
