// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import { FinanceDashboard } from './FinanceDashboard';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEventsTicketsConfiguration, tYourTicketProviderPurchases, tYourTicketProviderTickets }
    from '@lib/database';

/**
 * Page that displays the financial dashboard for the given event.
 */
export default async function EventFinancePage(props: PageProps<'/admin/events/[event]/finance'>) {
    const { access, event } = await requireAuthenticationWithEvent(props, 'statistics.finances');

    const service = await createTicketService(event.id);
    if (!service)
        notFound();

    const dbInstance = db;

    const eventsTicketsConfigurationJoin = tEventsTicketsConfiguration.forUseInLeftJoin();

    let mostRecentUpdate: Temporal.ZonedDateTime | undefined;
    let pendingCategorisationCount: number | undefined;

    switch (service.id) {
        case 'Weeztix':
            throw new Error('Support for Weeztix is not yet implemented.');

        case 'YourTicketProvider': {
            const ytpEventId = Number(service.eventId);

            mostRecentUpdate = await dbInstance.selectFrom(tYourTicketProviderPurchases)
                .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(ytpEventId))
                .selectOneColumn(
                    dbInstance.max(tYourTicketProviderPurchases.ytpPurchaseItemUpdated))
                .executeSelectNoneOrOne() ?? undefined;

            pendingCategorisationCount = await dbInstance.selectFrom(tYourTicketProviderTickets)
                .leftJoin(eventsTicketsConfigurationJoin)
                    .on(eventsTicketsConfigurationJoin.eventId.equals(event.id))
                        .and(eventsTicketsConfigurationJoin.eventTicketYtpId.equals(
                                 tYourTicketProviderTickets.ytpTicketId))
                .where(tYourTicketProviderTickets.ytpTicketEventId.equals(ytpEventId))
                    .and(eventsTicketsConfigurationJoin.eventTicketCategory.isNull())
                .selectCountAll()
                .executeSelectOne();

            break;
        }
    }

    const headerActions: React.ReactNode[] = [];
    if (!!mostRecentUpdate) {
        headerActions.push(
            <Tooltip title="Data updated on…" key="updated">
                <Chip size="small" color="primary" variant="outlined" label={
                    <LocalDateTime dateTime={mostRecentUpdate.toString()}
                                   format="dddd, MMMM Do [at] HH:mm" />
                } />
            </Tooltip>);
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
            <FinanceDashboard event={event.slug} />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Finances', { event: 'event' });
