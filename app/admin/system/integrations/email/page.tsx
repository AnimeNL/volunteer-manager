// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import EmailIcon from '@mui/icons-material/Email';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SendIcon from '@mui/icons-material/Send';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { ConnectionCheck } from './ConnectionCheck';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { EmailMessage } from '@lib/integrations/email/EmailMessage';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TestMessageButton } from './TestMessageButton';
import { createEmailClient } from '@lib/integrations/email';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts } from '@lib/database';

import { createEmailAccount } from './EmailActions';

/**
 * Server Action through which an e-mail connection check for the given `accountId` can be run.
 */
async function executeConnectionCheck(input: unknown) {
    'use server';
    return executeServerAction(input, z.object({ accountId: z.number() }), async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.integrations');

        console.warn(`[Health check] Verifying configuration for e-mail account ${data.accountId}`);

        try {
            const client = await createEmailClient(data.accountId);
            await client.verifyConfiguration();

            return {
                success: true,
            };

        } catch (error: any) {
            return {
                success: false,
                error: `Exception: ${error.message}`,
            };
        }
    });
}

/**
 * Server Action through which a test message can be send to an e-mail account.
 */
async function sendTestMessage(accountId: number, input: unknown) {
    'use server';
    return executeServerAction(input, z.object({ /* no parameters */ }), async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.integrations');

        if (!props.user.username)
            return { success: false, error: 'Your e-mail address it not known.' };

        // Wait for a second to at least give this a dramatic effect.
        await new Promise(resolve => setTimeout(resolve, 1000));

        const message = new EmailMessage()
            .setTo(props.user.username)
            .setSubject('Test message from the AnimeCon Volunteer Manager')
            .setText(`This is a test message initiated by ${props.user.name}.`);

        const client = await createEmailClient(accountId);
        await client.sendMessage({
            sender: 'AnimeCon Volunteer Manager',
            sourceUser: props.user.id,
            targetUser: props.user.id,
            message,
        });

        return { success: true };
    });
}

/**
 * Data source through which the configured e-mail accounts can be retrieved.
 */
const emailAccountsDataSource = createDataSource('admin/system/integrations/email', withRowModel({
    /**
     * Unique ID of the e-mail account.
     */
    id: z.number(),

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
        const accounts = await db.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                id: tEmailAccounts.emailAccountId,
                address: tEmailAccounts.emailAccountAddress,
                smtpHostname: tEmailAccounts.emailAccountSmtpHostname,
                smtpPort: tEmailAccounts.emailAccountSmtpPort,
                imapHostname: tEmailAccounts.emailAccountImapHostname,
                imapPort: tEmailAccounts.emailAccountImapPort,
            })
            .orderBy('address', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: accounts.count,
            rows: accounts.data.map(row => ({
                id: row.id,
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

    const outboundAccounts = await db.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountSmtpHostname.notEquals(''))
        .select({
            id: tEmailAccounts.emailAccountId,
            address: tEmailAccounts.emailAccountAddress,
        })
        .orderBy('address', 'asc')
        .executeSelectMany();

    const columns: Column<ExtractRowModel<typeof emailAccountsDataSource>>[] = [
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
            { outboundAccounts.length > 0 &&
                <>
                    <Section icon={ <SettingsEthernetIcon /> } title="Connection check">
                        <SectionIntroduction>
                            A connection check will help validate that all account details are still
                            valid.
                        </SectionIntroduction>
                        <ConnectionCheck accounts={outboundAccounts}
                                         action={executeConnectionCheck} />
                    </Section>
                    <Section icon={ <SendIcon /> } title="Test messages">
                        <SectionIntroduction>
                            Sending yourself a test message is another way to validate
                            functionality.
                        </SectionIntroduction>
                        <List dense disablePadding>
                            { outboundAccounts.map((account, index) =>
                                <ListItem key={account.id} disableGutters
                                          divider={ index < (outboundAccounts.length - 1) }>
                                    <ListItemIcon>
                                        <EmailOutlinedIcon />
                                    </ListItemIcon>
                                    <ListItemText primary={account.address} />
                                    <TestMessageButton
                                        action={ sendTestMessage.bind(null, account.id) } />
                                </ListItem> )}
                        </List>
                    </Section>
                </> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('E-mail accounts', 'Integrations', 'System');
