// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import { MobileFloatingPill, MobileNavigationBar } from './MobileNavigationBar';
import { getEvent } from '@lib/cache';
import { getNavigationData } from '../lib/scheduleData';

/**
 * Props accepted by the <MobileNavigation> component.
 */
interface MobileNavigationProps {
    /**
     * Route params promise from the `[event]` layout, awaited inside `<Suspense>`.
     */
    params: Promise<{ event: string }>;
}

/**
 * Streams live volunteer navigation counts (for the More activity badge and More sheet items) and
 * the event identity banner behind `<Suspense>`, reusing the request-cached `getNavigationData()`.
 */
async function AuthenticatedMobileNavigation(props: MobileNavigationProps) {
    const { event: eventSlug } = await props.params;
    const [ data, event ] = await Promise.all([
        getNavigationData(eventSlug),
        getEvent(eventSlug),
    ]);

    return (
        <MobileNavigationBar
            data={data}
            eventBannerUrl={event?.imageUrl ?? '/images/admin/event-header.jpg'}
            eventName={event?.name} />
    );
}

/**
 * Fixed M3 Expressive floating pill bottom navigation for the `app/schedule2/` App Shell, anchored
 * across view transitions. Renders a static fallback immediately so the App Shell prerenders
 * without awaiting dynamic route params.
 */
export function MobileNavigation(props: MobileNavigationProps) {
    return (
        <Suspense fallback={ <MobileFloatingPill activeTab="overview" /> }>
            <AuthenticatedMobileNavigation params={props.params} />
        </Suspense>
    );
}
