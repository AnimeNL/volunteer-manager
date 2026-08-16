// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import CategoryIcon from '@mui/icons-material/Category';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';
import db, { tUsers } from '@lib/database';

/**
 * The <AccountInformationLayout> is used to configure the tabs accessible for an account.
 */
export default async function AccountInformationLayout(
    props: LayoutProps<'/admin/organisation/accounts/[id]'>)
{
    const { access } = await requireAuthentication();
    const { id } = await props.params;

    const anonimized = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(Number(id)))
        .selectOneColumn(tUsers.anonymized.isNotNull())
        .executeSelectNoneOrOne();

    if (typeof anonimized !== 'boolean')
        notFound();

    if (anonimized)
        return <AnonymizedAccountLayout />;

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: PersonIcon,
                label: 'Account',
                url: `/admin/organisation/accounts/${id}`,
                urlMatchMode: 'strict',
            },
            {
                Icon: InfoOutlinedIcon,
                label: 'Logs',
                url: `/admin/organisation/accounts/${id}/logs`,
            },
            {
                Icon: CategoryIcon,
                label: 'Permissions',
                url: `/admin/organisation/accounts/${id}/permissions`,
            },
            {
                Icon: SettingsOutlinedIcon,
                label: 'Settings',
                url: `/admin/organisation/accounts/${id}/settings`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}

/**
 * Specific layout indicating that the user is attempting to access the page of an anonymized
 * account. The actual information will not be shared, and instead an explanation of what's going on
 * will be displayed.
 */
function AnonymizedAccountLayout() {
    return (
        <Section icon={ <PersonOffIcon color="primary" /> } title="Account anonimized"
                 breadcrumbs={[
                     { label: 'Organisation', href: '/admin/organisation' },
                     { label: 'Accounts', href: '/admin/organisation/accounts' },
                     { label: 'Anonymous badger' },
                 ]}>
            <Alert severity="error" variant="outlined">
                This account has been anonymized, meaning that all identifiable information has been
                removed and the account is permanently disabled. As a result, the account settings
                and controls associated with it are no longer accessible.
            </Alert>
        </Section>
    );
}
