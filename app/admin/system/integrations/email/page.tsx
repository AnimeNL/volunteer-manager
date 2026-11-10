// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import EmailIcon from '@mui/icons-material/Email';
import Grid from '@mui/material/Grid';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { OutgoingCell, OutgoingHeader } from './EmailCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tTeams } from '@lib/database';

import { createEmailAccount } from './EmailActions';

/**
 * Data source through which the configured e-mail accounts can be retrieved.
 */
const emailAccountsDataSource = createDataSource('admin/system/integrations/email', withRowModel({
    /**
     * Unique ID of the e-mail account.
     */
    id: z.number(),

    /**
     * Whether this is the default outgoing e-mail account for the system.
     */
    isDefault: z.boolean(),

    /**
     * Active teams that use this e-mail account for outgoing messages.
     */
    teams: z.array(z.string()),

    /**
     * E-mail address associated with this account.
     */
    address: z.string(),

    /**
     * Outgoing (SMTP) server configured for this account, when available.
     */
    outgoingServer: z.string().nullable(),

    /**
     * Incoming (IMAP) server configured for this account, when available.
     */
    incomingServer: z.string().nullable(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'system.integrations');
    },

    async list(params) {
        const defaultAccountId = await readSetting('integration-email-default-account-id') ?? 1;

        const teamsJoin = tTeams.forUseInLeftJoin();

        const dbInstance = db;
        const accounts = await dbInstance.selectFrom(tEmailAccounts)
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamEmailAccountId.equals(tEmailAccounts.emailAccountId))
                    .and(teamsJoin.teamDeleted.isNull())
            .where(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                id: tEmailAccounts.emailAccountId,
                address: tEmailAccounts.emailAccountAddress,
                smtpHostname: tEmailAccounts.emailAccountSmtpHostname,
                smtpPort: tEmailAccounts.emailAccountSmtpPort,
                imapHostname: tEmailAccounts.emailAccountImapHostname,
                imapPort: tEmailAccounts.emailAccountImapPort,
                teams: dbInstance.aggregateAsArrayOfOneColumn(teamsJoin.teamName),
            })
            .groupBy(tEmailAccounts.emailAccountId)
            .orderBy('address', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: accounts.count,
            rows: accounts.data.map(row => ({
                id: row.id,
                isDefault: row.id === defaultAccountId,
                teams: [ ...row.teams ].sort((lhs, rhs) => lhs.localeCompare(rhs)),
                address: row.address,
                outgoingServer: row.smtpHostname ? `${row.smtpHostname}:${row.smtpPort}` : null,
                incomingServer: row.imapHostname && row.imapPort
                    ? `${row.imapHostname}:${row.imapPort}`
                    : null,
            })),
        };
    },
});

/**
 * Page that allows administrators to configure and manage the e-mail accounts available in the
 * Volunteer Manager for sending outbound and receiving inbound messages.
 */
export default async function EmailIntegrationPage() {
    await requireAuthentication('system.integrations');

    const columns: Column<ExtractRowModel<typeof emailAccountsDataSource>>[] = [
        {
            field: 'id',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: OutgoingHeader,
                component: OutgoingCell,
            },
        },
        {
            field: 'address',
            headerName: 'Address',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                href: '/admin/system/integrations/email/{id}',
            },
        },
        {
            field: 'outgoingServer',
            headerName: 'Outgoing server',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                defaultValue: 'Not configured',
            },
        },
        {
            field: 'incomingServer',
            headerName: 'Incoming server',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                defaultValue: 'Not configured',
            },
        },
    ];

    return (
        <>
            <Section icon={ <EmailIcon color="primary" /> } title="E-mail accounts"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'E-mail accounts' },
                     ]}>
                <SectionIntroduction>
                    The Volunteer Manager supports multiple e-mail accounts for outbound and inbound
                    messaging.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns} defaultSort={{ field: 'address', sort: 'asc' }}
                    source={emailAccountsDataSource}
                    pageSize={25} disableFooter disableSearch
                    listViewProps={{
                        primaryField: 'address',
                        secondaryField: 'outgoingServer',
                        linkTemplate: '/admin/system/integrations/email/{id}',
                        startComponent: OutgoingCell,
                    }} />
            </Section>
            <FormGridSection icon={ <AddCircleOutlineOutlinedIcon /> }
                             title="Add a new account"
                             action={createEmailAccount} callToAction="Add">
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="address" label="E-mail address" fullWidth size="small"
                                      placeholder="team@animecon.nl" required />
                </Grid>
            </FormGridSection>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('E-mail accounts', 'Integrations', 'System');
