// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Paper from '@mui/material/Paper';

import { MuiLicense } from '@components/MuiLicense';
import { Navigation, type NavigationProps } from './components/Navigation';
import { RegistrationLayout } from '@app/registration/RegistrationLayout';
import { determineEnvironment } from '@lib/Environment';
import { determineFilters } from './Filters';
import db, { tEvents, tEventsSales } from '@lib/database';

/**
 * Root layout for the statistics interface, displaying year-on-year data on the key performance
 * indicators of the AnimeCon Volunteering Teams.
 */
export default async function StatisticsLayout(props: LayoutProps<'/statistics'>) {
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const filters = await determineFilters();

    let enableSales: NavigationProps['enableSales'] = [ /* none */ ];
    let recentSalesUpdate: string | undefined;

    if (!!filters.access.finances) {
        enableSales = filters.events.filter(event => !!event.hasSales).map(event => ({
            name: event.name,
            slug: event.slug,
        }));

        const dbInstance = db;
        const recentSalesUpdateTemporal = await db.selectFrom(tEvents)
            .innerJoin(tEventsSales)
                .on(tEventsSales.eventId.equals(tEvents.eventId))
            .where(tEvents.eventSlug.in(enableSales.map(v => v.slug)))
                .and(tEvents.eventHidden.equals(/* false= */ 0))
            .selectOneColumn(dbInstance.max(tEventsSales.eventSaleUpdated))
            .executeSelectNoneOrOne();

        recentSalesUpdate = recentSalesUpdateTemporal?.toString();
    }

    return (
        <RegistrationLayout environment={environment} maxWidth="xl">
            <MuiLicense />
            <Paper sx={{ mb: 2, px: 2, py: 1 }}>
                <Navigation enableSales={enableSales} recentSalesUpdate={recentSalesUpdate} />
            </Paper>
            {props.children}
        </RegistrationLayout>
    );
}
