// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import EmailIcon from '@mui/icons-material/Email';
import Grid from '@mui/material/Grid';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import Stack from '@mui/material/Stack';

import { DeleteEmailAccountAction } from './DeleteEmailAccountAction';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SmtpConnectionCheckButton } from './SmtpConnectionCheckButton';
import { TestMessageButton } from './TestMessageButton';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tTeams } from '@lib/database';

import { kMaskedPassword } from '../EmailActions';

import { checkEmailAccountSmtp, deleteEmailAccount, sendEmailAccountTestMessage,
    updateEmailAccountImap, updateEmailAccountSmtp } from '../EmailActions';

/**
 * Page that allows administrators to configure both the outgoing (SMTP) and incoming (IMAP) server
 * details of an individual e-mail account.
 */
export default async function EmailAccountPage(
    props: PageProps<'/admin/system/integrations/email/[id]'>)
{
    await requireAuthentication('system.integrations');

    const params = await props.params;

    const accountId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(accountId))
        notFound();

    const dbInstance = db;
    const account = await dbInstance.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountId.equals(accountId))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
        .select({
            id: tEmailAccounts.emailAccountId,
            address: tEmailAccounts.emailAccountAddress,
            smtpHostname: tEmailAccounts.emailAccountSmtpHostname,
            smtpPort: tEmailAccounts.emailAccountSmtpPort,
            smtpUsername: tEmailAccounts.emailAccountSmtpUsername,
            hasSmtpPassword: tEmailAccounts.emailAccountSmtpPassword.notEquals(''),
            imapHostname: tEmailAccounts.emailAccountImapHostname,
            imapPort: tEmailAccounts.emailAccountImapPort,
            imapUsername: tEmailAccounts.emailAccountImapUsername,
            hasImapPassword: tEmailAccounts.emailAccountImapPassword.isNotNull(),
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    const defaultAccountId = await readSetting('integration-email-default-account-id') ?? 1;
    const linkedTeamCount = await dbInstance.selectFrom(tTeams)
        .where(tTeams.teamEmailAccountId.equals(account.id))
            .and(tTeams.teamDeleted.isNull())
        .selectCountAll()
        .executeSelectNoneOrOne();

    const isProtected = account.id === defaultAccountId || !!linkedTeamCount;

    const smtpDefaultValues = {
        smtpHostname: account.smtpHostname,
        smtpPort: account.smtpPort,
        smtpUsername: account.smtpUsername,
        smtpPassword: account.hasSmtpPassword ? kMaskedPassword : '',
    };

    const imapDefaultValues = {
        imapHostname: account.imapHostname ?? '',
        imapPort: account.imapPort ?? '',
        imapUsername: account.imapUsername ?? '',
        imapPassword: account.hasImapPassword ? kMaskedPassword : '',
    };

    const headerAction = (
        <DeleteEmailAccountAction action={ deleteEmailAccount.bind(null, account.id) }
                                  address={account.address} disabled={isProtected} />
    );

    const updateSmtpFn = updateEmailAccountSmtp.bind(null, account.id);
    const updateImapFn = updateEmailAccountImap.bind(null, account.id);
    const checkSmtpFn = checkEmailAccountSmtp.bind(null, account.id);
    const sendTestMessageFn = sendEmailAccountTestMessage.bind(null, account.id);

    const smtpConfigured = !!account.smtpHostname && account.hasSmtpPassword;

    return (
        <>
            <Section icon={ <EmailIcon color="primary" /> } title={account.address}
                     headerAction={headerAction}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'E-mail accounts', href: '/admin/system/integrations/email' },
                         { label: account.address },
                     ]}>
                <SectionIntroduction>
                    E-mail server configuration for <strong>{account.address}</strong>.
                </SectionIntroduction>
            </Section>
            <FormGridSection icon={ <OutboxOutlinedIcon /> } title="Outgoing server (SMTP)"
                             action={updateSmtpFn} defaultValues={smtpDefaultValues}>
                <SectionIntroduction grid>
                    Required server details used for sending outbound e-mail messages.
                </SectionIntroduction>
                <Grid size={{ xs: 12, md: 9 }}>
                    <TextFieldElement name="smtpHostname" label="SMTP hostname" fullWidth
                                      size="small" required placeholder="smtp.sendgrid.net" />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextFieldElement name="smtpPort" label="Port" type="number" fullWidth
                                      size="small" required placeholder="587" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="smtpUsername" label="Username" fullWidth size="small"
                                      required placeholder="apikey" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="smtpPassword" label="Password" type="password"
                                      fullWidth size="small" required
                                      placeholder="Password / API key" />
                </Grid>
            </FormGridSection>
            <FormGridSection icon={ <InboxOutlinedIcon /> } title="Incoming server (IMAP)"
                             action={updateImapFn} defaultValues={imapDefaultValues}>
                <SectionIntroduction grid>
                    Optional server details used for receiving inbound e-mail messages. Leave blank
                    to disable incoming e-mail for this account.
                </SectionIntroduction>
                <Grid size={{ xs: 12, md: 9 }}>
                    <TextFieldElement name="imapHostname" label="IMAP hostname" fullWidth
                                      size="small" placeholder="imap.gmail.com" />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextFieldElement name="imapPort" label="Port" type="number" fullWidth
                                      size="small" placeholder="993" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="imapUsername" label="Username" fullWidth size="small"
                                      placeholder="volunteer-manager@animecon.nl" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="imapPassword" label="Password" type="password"
                                      fullWidth size="small"
                                      placeholder="Password / app password" />
                </Grid>
            </FormGridSection>
            <Section noHeader>
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <SmtpConnectionCheckButton action={checkSmtpFn} disabled={!smtpConfigured} />
                    <TestMessageButton action={sendTestMessageFn} disabled={!smtpConfigured} />
                </Stack>
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'E-mail accounts', 'Integrations', 'System');
