// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import { FinanceDashboard } from './FinanceDashboard';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { generateEventMetadataFn } from '../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEventsSales } from '@lib/database';

/**
 * The <FinancePage> component represents the financial dashboard of a certain AnimeCon event. This
 * data is only accessible to a subset of our users, as it's not usually applicable.
 */
export default async function FinancePage(props: PageProps<'/admin/events/[event]/finance'>) {
    const { access, event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'statistics.finances',
    });

    const dbInstance = db;
    const mostRecentUpdate = await dbInstance.selectFrom(tEventsSales)
        .where(tEventsSales.eventId.equals(event.id))
        .selectOneColumn(dbInstance.max(tEventsSales.eventSaleUpdated))
        .groupBy(tEventsSales.eventId)
        .executeSelectNoneOrOne();

    const headerActions: React.ReactNode[] = [];
    if (access.can('event.settings', { event: event.slug })) {
        headerActions.push(
            <Tooltip title="Settings" key="settings">
                <IconButton LinkComponent={Link} href="./finance/settings" size="small">
                    <SettingsIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        )
    }

    if (!!mostRecentUpdate) {
        headerActions.push(
            <Tooltip title="Data updated on…" key="updated">
                <Chip size="small" color="primary" variant="outlined" label={
                    <LocalDateTime dateTime={mostRecentUpdate.toString()}
                                   format="dddd, MMMM Do [at] HH:mm" />
                } />
            </Tooltip>);
    }

    return (
        <>
            <Section title="Finances" subtitle={event.shortName}
                     icon={ <AnalyticsOutlinedIcon color="primary" /> } headerAction={
                        <Stack direction="row" spacing={2} alignItems="center">
                            {headerActions}
                        </Stack>
                     }>
                <SectionIntroduction>
                    This is the financial dashboard for {event.shortName}, showing key ticket sale
                    figures and comparisons with past editions.
                </SectionIntroduction>
            </Section>
            <FinanceDashboard event={event.slug} />
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Finances');
