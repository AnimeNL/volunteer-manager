// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { z } from 'zod/v4';

import StreamIcon from '@mui/icons-material/Stream';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { EligibilityCell, EligibilityHeader } from './SubscriptionCells';
import { Publish, kSubscriptionType } from '@lib/subscriptions';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SubscriptionTestAction } from './SubscriptionTestAction';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { queryUsersWithPermission } from '@lib/auth/AccessQuery';
import db, { tSubscriptions, tUsers } from '@lib/database';

/**
 * Data source through which subscriptions can be retrieved.
 */
const subscriptionsDataSource = createDataSource('admin/system/subscriptions', withRowModel({
    /**
     * Unique ID of the volunteer.
     */
    id: z.number(),

    /**
     * Whether the use is eligible to be subscribed to publications.
     */
    eligible: z.boolean(),

    /**
     * Name of the volunteer.
     */
    name: z.string(),

    /**
     * Number of subscriptions this volunteer has.
     */
    subscriptionCount: z.number(),

    /**
     * Label to display indicating how many active subscriptions there are.
     */
    subscriptionLabel: z.string().nullable(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.subscriptions.management',
        });
    },

    async list(params) {
        const eligibleUsers = await queryUsersWithPermission('system.subscriptions.eligible');
        const eligibleUserIds = new Set(eligibleUsers.map(user => user.id));

        const dbInstance = db;
        const subscriptionsJoin = tSubscriptions.forUseInLeftJoin();

        const allUsers = await dbInstance.selectFrom(tUsers)
            .leftJoin(subscriptionsJoin)
                .on(subscriptionsJoin.subscriptionUserId.equals(tUsers.userId))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                subscriptionCount: dbInstance.count(subscriptionsJoin.subscriptionId),
            })
            .groupBy(tUsers.userId)
            .executeSelectMany();

        const rows = allUsers
            .map(user => ({
                ...user,
                eligible: eligibleUserIds.has(user.id),
                subscriptionLabel:
                    user.subscriptionCount === 0
                        ? null
                        : user.subscriptionCount > 1
                            ? `${user.subscriptionCount} active subscriptions`
                            : `${user.subscriptionCount} active subscription`,
            }))
            .filter(row => row.subscriptionCount || row.eligible);

        const sortField = params.sort.field;
        const sortDirection = params.sort.direction;

        rows.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortField === 'subscriptionCount') {
                comparison = a.subscriptionCount - b.subscriptionCount;
            } else if (sortField === 'id') {
                comparison = a.id - b.id;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return {
            rowCount: rows.length,
            rows,
        };
    },
});

/**
 * Server action that will publish a test notification to all users who have subscribed to test
 * messages.
 */
async function publishTestMessage() {
    'use server';
    await executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals',
        });

        await Publish({
            type: kSubscriptionType.Test,
            sourceUserId: props.user.id,
            message: {
                userId: props.user.id,
                name: props.user.nameOrFirstName,
            },
        });
    });
}

/**
 * The <SubscriptionPage> is the main page of the subscription functionality, which allows us to
 * selectively sign up certain people to automated and/or privileged messaging.
 */
export default async function SubscriptionPage() {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.subscriptions.management',
    });

    let action: React.ReactNode;
    if (access.can('system.internals'))
        action = <SubscriptionTestAction testFn={publishTestMessage} />;

    const columns: Column<ExtractRowModel<typeof subscriptionsDataSource>>[] = [
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
            sortable: true,

            template: 'text',
            templateProps: {
                href: '/admin/system/subscriptions/{id}',
            },
        },
        {
            field: 'subscriptionLabel',
            headerName: 'Active subscriptions',
            flex: 1,
            sortable: true,

            template: 'text',
        },
    ];

    return (
        <>
            <Section icon={ <StreamIcon color="primary" /> } headerAction={action}
                     title="Subscriptions" breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Subscriptions' },
                     ]}>
                <SectionIntroduction>
                    Any person granted the <strong>subscription eligibility permission</strong> can
                    be subscribed to a variety of notifications.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns}
                    source={subscriptionsDataSource}
                    defaultSort={{ field: 'name', sort: 'asc' }}
                    disableFooter
                    pageSize={100}
                    listViewProps={{
                        primaryField: 'name',
                        secondaryField: 'subscriptionLabel',
                        linkTemplate: './subscriptions/{id}',
                        startComponent: EligibilityCell,
                    }}
                />
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Subscriptions | AnimeCon Volunteer Manager',
};
