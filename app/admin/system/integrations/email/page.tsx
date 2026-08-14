// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import EmailIcon from '@mui/icons-material/Email';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { readSetting } from '@lib/Settings';
import db, { tEmailAccounts } from '@lib/database';

/**
 * Data source through which the configured e-mail accounts can be retrieved and managed.
 */
const emailAccountsDataSource = createDataSource('admin/system/integrations/email', withRowModel({
    /**
     * Unique ID of the e-mail account.
     */
    id: z.number(),

    /**
     * Whether this row is protected from being deleted.
     */
    protected: z.boolean(),

    /**
     * E-mail address associated with this account.
     */
    address: z.string(),

    /**
     * Hostname of the SMTP server used for outbound delivery.
     */
    smtpHostname: z.string(),

    /**
     * Port number of the SMTP server.
     */
    smtpPort: z.number(),

    /**
     * Username used for authenticating with the SMTP server.
     */
    smtpUsername: z.string(),

    /**
     * Password used for authenticating with the SMTP server.
     */
    smtpPassword: z.string(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.integrations',
        });
    },

    async create(partialRow, props) {
        if (!partialRow.address || !partialRow.smtpHostname || !partialRow.smtpPort ||
            !partialRow.smtpUsername || !partialRow.smtpPassword)
        {
            return false;
        }

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tEmailAccounts)
            .set({
                emailAccountAddress: partialRow.address,
                emailAccountSmtpHostname: partialRow.smtpHostname,
                emailAccountSmtpPort: partialRow.smtpPort,
                emailAccountSmtpUsername: partialRow.smtpUsername,
                emailAccountSmtpPassword: partialRow.smtpPassword,
                emailAccountCreated: dbInstance.currentZonedDateTime(),
                emailAccountUpdated: dbInstance.currentZonedDateTime(),
                emailAccountDeleted: null,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateEmailAddress')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: partialRow.address,
            });

        return !!insertId;
    },

    async delete(row, props) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEmailAccounts)
            .set({
                emailAccountDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tEmailAccounts.emailAccountId.equals(row.id))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteEmailAddress')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: row.address,
            });

        return !!affectedRows;
    },

    async list(params) {
        const defaultAccountId = await readSetting('integration-email-default-account-id') ?? 1;

        const dbInstance = db;
        const accounts = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                id: tEmailAccounts.emailAccountId,
                protected: tEmailAccounts.emailAccountId.equals(defaultAccountId),
                address: tEmailAccounts.emailAccountAddress,
                smtpHostname: tEmailAccounts.emailAccountSmtpHostname,
                smtpPort: tEmailAccounts.emailAccountSmtpPort,
                smtpUsername: tEmailAccounts.emailAccountSmtpUsername,
                smtpPassword: tEmailAccounts.emailAccountSmtpPassword,
            })
            .orderBy('address', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: accounts.count,
            rows: accounts.data,
        };
    },

    async update(row, previousRow, props) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEmailAccounts)
            .set({
                emailAccountAddress: row.address,
                emailAccountSmtpHostname: row.smtpHostname,
                emailAccountSmtpPort: row.smtpPort,
                emailAccountSmtpUsername: row.smtpUsername,
                emailAccountSmtpPassword: row.smtpPassword,
                emailAccountUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tEmailAccounts.emailAccountId.equals(row.id))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateEmailAddress')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: row.address,
            });

        return !!affectedRows;
    },
});

/**
 * Page that allows administrators to configure and manage the e-mail accounts available in the
 * Volunteer Manager for sending outbound messages.
 */
export default async function EmailIntegrationPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.integrations',
    });

    const columns: Column<ExtractRowModel<typeof emailAccountsDataSource>>[] = [
        {
            field: 'address',
            headerName: 'Address',
            editable: true,
            sortable: false,
            flex: 2,

            editorProps: {
                placeholder: 'volunteer-manager@animecon.nl',
                required: true,
            },
        },
        {
            field: 'smtpHostname',
            headerName: 'SMTP host',
            editable: true,
            sortable: false,
            flex: 2,

            editorProps: {
                placeholder: 'smtp.sendgrid.net',
                required: true,
            },
        },
        {
            field: 'smtpPort',
            headerAlign: 'left',
            headerName: 'Port',
            align: 'left',
            type: 'number',
            editable: true,
            sortable: false,
            width: 75,

            editorProps: {
                placeholder: '587',
                required: true,
            },
        },
        {
            field: 'smtpUsername',
            headerName: 'Username',
            editable: true,
            sortable: false,
            flex: 2,

            editorProps: {
                placeholder: 'apikey',
                required: true,
            },
        },
        {
            field: 'smtpPassword',
            headerName: 'Password',
            editable: true,
            sortable: false,
            flex: 2,

            editorProps: {
                placeholder: 'Password / API key',
                required: true,
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
                    The Volunteer Manager supports multiple e-mail accounts for outbound messaging.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns} defaultSort={{ field: 'address', sort: 'asc' }}
                    source={emailAccountsDataSource}
                    subject="e-mail account" protectedColumn="protected"
                    pageSize={25} disableFooter
                    listViewProps={{
                        primaryField: 'address',
                        secondaryTemplate: '{smtpHostname}:{smtpPort}',
                    }} />
            </Section>
            <Section icon={ <SettingsEthernetIcon /> } title="Connection check">
                <SectionIntroduction>
                    A connection check will help validate that all account details are still valid.
                </SectionIntroduction>
                { /* TODO */ }
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('E-mail accounts', 'Integrations', 'System');
