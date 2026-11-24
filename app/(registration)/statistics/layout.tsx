// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Paper from '@mui/material/Paper';

import { MuiLicense } from '@components/MuiLicense';
import { Navigation, type NavigationProps } from './components/Navigation';
import { RegistrationLayout } from '../registration/RegistrationLayout';
import { createTicketService } from '@lib/tickets';
import { determineEnvironment } from '@lib/Environment';
import { determineFilters } from './Filters';

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

    if (!!filters.access.finances) {
        const salesEvents = filters.events.filter(event => !!event.hasSales);

        enableSales = await Promise.all(salesEvents.map(async event => {
            const service = await createTicketService(event.id);
            const summary = await service?.getFinancialSummary(event.id);

            return {
                name: event.name,
                slug: event.slug,
                updated: summary?.mostRecentUpdate?.toString(),
            };
        }));
    }

    return (
        <RegistrationLayout environment={environment} maxWidth="xl">
            <MuiLicense />
            <Paper sx={{ mb: 2, px: 2, py: 1 }}>
                <Navigation enableSales={enableSales} />
            </Paper>
            {props.children}
        </RegistrationLayout>
    );
}
