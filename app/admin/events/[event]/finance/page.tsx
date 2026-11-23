// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';

import type { FinancialFilter } from '@lib/tickets/Types';
import { FinanceDashboard } from './FinanceDashboard';
import { FinanceFilterButton } from './FinanceFilterButton';
import { FinanceUpdatedChip } from './FinanceUpdatedChip';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/auth';

/**
 * Page that displays the financial dashboard for the given event.
 */
export default async function EventFinancePage(props: PageProps<'/admin/events/[event]/finance'>) {
    const { access, event } =
        await requireAuthenticationWithEvent(props, 'statistics.finances');

    const service = await createTicketService(event.id);
    if (!service)
        notFound();

    const searchParams = await props.searchParams;
    const filter: FinancialFilter = {
        utmSource: typeof searchParams.utm_source === 'string'
            ? searchParams.utm_source || undefined
            : undefined,
        utmCampaign: typeof searchParams.utm_campaign === 'string'
            ? searchParams.utm_campaign || undefined
            : undefined,
    };

    const [ { mostRecentUpdate, pendingCategorisationCount }, filterOptions ] = await Promise.all([
        service.getFinancialSummary(event.id),
        service.fetchFinancialFilterOptions(),
    ]);

    const headerActions: React.ReactNode[] = [];
    if (!!mostRecentUpdate) {
        headerActions.push(
            <FinanceUpdatedChip updated={ mostRecentUpdate.toString() } key="updated" />);
    }

    if (filterOptions.utmSources.length > 0 || filterOptions.utmCampaigns.length > 0 ||
            filter.utmSource || filter.utmCampaign) {
        headerActions.push(
            <FinanceFilterButton filter={filter} options={filterOptions} key="filter" />);
    }

    if (access.can('event.settings', { event: event.slug })) {
        headerActions.push(
            <IconButton LinkComponent={Link} href="./finance/settings" size="small" key="settings">
                <Badge variant="dot" color="error" invisible={!pendingCategorisationCount}>
                    <SettingsIcon fontSize="small" />
                </Badge>
            </IconButton>
        );
    }

    return (
        <>
            <Section icon={ <AnalyticsOutlinedIcon color="primary" /> } title="Finances"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Finances' },
                     ]}
                     headerAction={
                         <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                             {headerActions}
                         </Stack>
                     }>
                <SectionIntroduction>
                    Financial dashboard for {event.shortName}, showing key ticket and product sales
                    figures.
                </SectionIntroduction>
            </Section>
            <FinanceDashboard event={event.slug} filter={filter} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Finances', { event: 'event' });
