// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import type { NextPageParams } from '@lib/NextRouterParams';
import { FinanceDashboard } from '@app/admin/events/[event]/finance2/FinanceDashboard';
import { determineFilters } from '../../Filters';
import { getEventBySlug } from '@lib/EventLoader';

/**
 * Page that displays sales statistics for a particular event. This page is only available for those
 * who have permission to see financial information, and its layout and capabilities are shared with
 * the financial overview page in the administration area.
 */
export default async function StatisticsPage(props: NextPageParams<'event'>) {
    const filters = await determineFilters();
    if (!filters.access.basic || !filters.access.finances)
        forbidden();

    const params = await props.params;

    const event = await getEventBySlug(params.event);
    if (!event || !filters.events.find(e => e.hasSales && e.id === event.id))
        notFound();

    return (
        <FinanceDashboard disableProductLinks event={event.slug} />
    );
}
