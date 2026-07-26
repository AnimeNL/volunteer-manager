// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MyLocationIcon from '@mui/icons-material/MyLocation';

import Link from '@app/LinkProxy';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tLogs } from '@lib/database';

/**
 * Overview page for IP address diagnostics, providing the ability to look up addresses.
 */
export default async function IpOverviewPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const oneMonthAgo = Temporal.Now.zonedDateTimeISO().subtract({ months: 1 });

    const activeIps = await db.selectFrom(tLogs)
        .where(tLogs.logDate.greaterOrEqual(oneMonthAgo))
            .and(tLogs.logDeleted.isNull())
            .and(tLogs.logSourceIpAddress.isNotNull())
            .and(tLogs.logSourceIpAddress.notEquals('::1'))
        .select({
            ipAddress: tLogs.logSourceIpAddress,
            count: db.count(tLogs.logId),
        })
        .groupBy(tLogs.logSourceIpAddress)
            .orderBy('count', 'desc')
        .limit(10)
        .executeSelectMany();

    return (
        <>
            <Section icon={ <LocationSearchingIcon color="primary" /> } title="IP Addresses"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'IP Addresses' },
                     ]}>
                <SectionIntroduction>
                    Insights into the IP addresses most active on the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section title="Recent activity">
                <List dense disablePadding>
                    {activeIps.map(({ ipAddress, count }, index) => (
                        <ListItemButton key={ipAddress!} component={Link} disableGutters
                                        href={`/admin/system/diagnostics/ip/${ipAddress}`}
                                        divider={ index < activeIps.length - 1 }>
                            <ListItemIcon>
                                <MyLocationIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={ipAddress}
                                secondary={count === 1 ? '1 action' : `${count} actions`} />
                        </ListItemButton>
                    ))}
                </List>
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('IP Addresses', 'Diagnostics', 'System');
