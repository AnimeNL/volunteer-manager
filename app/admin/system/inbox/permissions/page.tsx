// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { EligibilityCell, EligibilityHeader } from './InboxPermissionCells';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { queryUsersWithPermission } from '@lib/auth/AccessQuery';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tEmailAccountsPermissions, tUsers } from '@lib/database';

/**
 * Data source through which volunteer inbox eligibility and active inbox assignments are retrieved.
 */
const dataSource = createDataSource('admin/system/inbox/permissions', withRowModel({
    /**
     * Unique ID of the volunteer.
     */
    id: z.number(),

    /**
     * Whether the volunteer is eligible to access inbound e-mail inboxes.
     */
    eligible: z.boolean(),

    /**
     * Name of the volunteer.
     */
    name: z.string(),

    /**
     * Label to display indicating how many accessible inboxes this volunteer has.
     */
    inboxLabel: z.string().nullable(),

}), {
    async authorize(_operation, props) {
        executeAccessCheck(props.authenticationContext, 'system.inbox.management');
    },

    async list(params) {
        const eligibleUsers = await queryUsersWithPermission('system.inbox.eligible');
        const eligibleUserIds = new Set(eligibleUsers.map(user => user.id));

        const dbInstance = db;
        const permissionsJoin = tEmailAccountsPermissions.forUseInLeftJoin();
        const emailAccountsJoin = tEmailAccounts.forUseInLeftJoin();

        const allUsers = await dbInstance.selectFrom(tUsers)
            .leftJoin(permissionsJoin)
                .on(permissionsJoin.userId.equals(tUsers.userId))
                    .and(permissionsJoin.permissionCreate.equals(/* true= */ 1).or(
                         permissionsJoin.permissionRead.equals(/* true= */ 1)).or(
                         permissionsJoin.permissionDelete.equals(/* true= */ 1)))
            .leftJoin(emailAccountsJoin)
                .on(emailAccountsJoin.emailAccountId.equals(permissionsJoin.emailAccountId))
                    .and(emailAccountsJoin.emailAccountDeleted.isNull())
                    .and(emailAccountsJoin.emailAccountImapHostname.isNotNull())
            .where(tUsers.anonymized.isNull())
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                inboxCount: dbInstance.count(emailAccountsJoin.emailAccountId),
            })
            .groupBy(tUsers.userId)
            .orderBy(tUsers.name, 'asc')
            .executeSelectMany();

        const rows = allUsers
            .map(user => ({
                ...user,
                eligible: eligibleUserIds.has(user.id),
                inboxLabel:
                    user.inboxCount === 0
                        ? null
                        : `${user.inboxCount} accessible inbox${user.inboxCount > 1 ? 'es' : ''}`,
            }))
            .filter(row => row.inboxCount > 0 || row.eligible);

        return {
            rowCount: rows.length,
            rows: rows.slice(params.page.offset, params.page.offset + params.page.limit),
        };
    },
});

/**
 * Overview page listing volunteers eligible for or explicitly granted access to e-mail inboxes.
 */
export default async function InboxPermissionsPage() {
    await requireAuthentication('system.inbox.management');

    const columns: Column<ExtractRowModel<typeof dataSource>>[] = [
        {
            display: 'flex',
            field: 'id',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            width: 50,
            sortable: false,

            template: 'component',
            templateProps: {
                headerComponent: EligibilityHeader,
                component: EligibilityCell,
            },
        },
        {
            field: 'name',
            headerName: 'Volunteer',
            flex: 1.5,
            sortable: false,

            template: 'text',
            templateProps: {
                href: '/admin/system/inbox/permissions/{id}',
            },
        },
        {
            field: 'inboxLabel',
            headerName: 'Accessible inboxes',
            flex: 1,
            sortable: false,

            template: 'text',
        },
    ];

    return (
        <>
            <Section icon={ <InboxOutlinedIcon color="primary" /> }
                     title="Inbox permissions"
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Inbox permissions' },
                     ]}>
                <SectionIntroduction>
                    Any person granted the inbox eligibility permission can be given access to our
                    inboxes.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns}
                    source={dataSource}
                    defaultSort={{ field: 'name', sort: 'asc' }}
                    disableSearch
                    pageSize={100}
                    listViewProps={{
                        primaryField: 'name',
                        secondaryField: 'inboxLabel',
                        linkTemplate: '/admin/system/inbox/permissions/{id}',
                        startComponent: EligibilityCell,
                    }}
                />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Inbox permissions', 'Communication');
