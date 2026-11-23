// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Bowser from 'bowser';
import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import DevicesIcon from '@mui/icons-material/Devices';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { AccessControl } from '@lib/auth/access';
import { AccountStatusButton } from '../AccountStatusButton';
import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log';
import { LogsDataTable } from '@app/admin/system/diagnostics/logs/LogsDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import { revokeUserSession } from '@lib/auth';
import db, { tUsers, tUsersSessions } from '@lib/database';

/**
 * Formats a raw `User-Agent` string into a human-readable browser and operating system summary
 * using Bowser, falling back to the raw string (or "Unknown") when parsing does not yield useful
 * information.
 */
function formatUserAgent(userAgent?: string): string {
    if (!userAgent)
        return 'Unknown';

    try {
        const parsed = Bowser.parse(userAgent);
        const browserName = parsed.browser.name;
        const majorVersion = parsed.browser.version?.split('.')[0];
        const browserLabel = browserName
            ? (majorVersion ? `${browserName} ${majorVersion}` : browserName)
            : undefined;

        const osName = parsed.os.name;

        if (browserLabel && osName)
            return `${browserLabel} on ${osName}`;
        if (browserLabel)
            return browserLabel;
        if (osName)
            return `Unknown browser on ${osName}`;
    } catch {
        // Ignore parsing failures and fall back to the raw user agent string.
    }

    return userAgent;
}

/**
 * Data source through which a user's active sessions can be listed and revoked.
 */
const accountSessionsDataSource =
    createDataSource('organisation/accounts/sessions', withContext(
{
    /**
     * Unique ID of the account for whom active sessions are being retrieved.
     */
    userId: z.number(),

}), withRowModel({
    /**
     * Unique ID of this session.
     */
    id: z.number(),

    /**
     * Date and time at which the session was created.
     */
    created: z.string(),

    /**
     * Date and time at which the session was last seen, if recorded.
     */
    lastSeen: z.string().optional(),

    /**
     * Human-readable browser and OS description parsed from the session's user agent.
     */
    device: z.string(),

    /**
     * IP address from which the session was created, if recorded.
     */
    ipAddress: z.string().optional(),

    /**
     * Account information of the administrator impersonating this user, if applicable.
     */
    impersonator: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

}), {
    async authorize(operation, props, context) {
        await requireAuthentication(props.authenticationContext, {
            permission: 'system.logs',
            operation: 'read',
        });

        if (operation === 'delete') {
            await requireAuthentication(props.authenticationContext, {
                permission: 'organisation.accounts',
                operation: 'update',
            });

            if (!props.access.can('root')) {
                const targetAccessInfo = await db.selectFrom(tUsers)
                    .where(tUsers.userId.equals(context.userId))
                    .select({
                        grants: tUsers.permissionsGrants,
                        revokes: tUsers.permissionsRevokes,
                        events: tUsers.permissionsEvents,
                        teams: tUsers.permissionsTeams,
                    })
                    .executeSelectNoneOrOne();

                if (!targetAccessInfo || new AccessControl(targetAccessInfo).can('root'))
                    forbidden();
            }
        }
    },

    async delete(row, props, context) {
        const revoked = await revokeUserSession(row.id, context.userId);
        if (revoked) {
            LogBuilder.for('AdminRevokeSession')
                .withInitiatorUser(props.user)
                .withAffectedUser(context.userId)
                .record({ device: row.device });
        }

        return revoked;
    },

    async list(params, props, context) {
        const impersonatorJoin = tUsers.forUseInLeftJoin();

        let sortField: 'created' | 'lastSeen' | 'ipAddress' | 'impersonator.name';
        switch (params.sort.field) {
            case 'created':
            case 'ipAddress':
                sortField = params.sort.field;
                break;

            case 'impersonator':
                sortField = 'impersonator.name';
                break;

            default:
                sortField = 'lastSeen';
                break;
        }

        const dbInstance = db;
        const sessions = await dbInstance.selectFrom(tUsersSessions)
            .leftJoin(impersonatorJoin)
                .on(impersonatorJoin.userId.equals(tUsersSessions.impersonatorUserId))
            .where(tUsersSessions.userId.equals(context.userId))
                .and(tUsersSessions.sessionExpires.greaterThan(dbInstance.currentZonedDateTime()))
            .select({
                id: tUsersSessions.sessionId,
                created: dbInstance.dateTimeAsString(tUsersSessions.sessionCreated),
                lastSeen: dbInstance.dateTimeAsString(tUsersSessions.sessionLastSeen),
                userAgent: tUsersSessions.sessionUserAgent,
                ipAddress: tUsersSessions.sessionIp,
                impersonator: {
                    id: impersonatorJoin.userId,
                    name: impersonatorJoin.name,
                },
            })
            .orderBy(sortField, params.sort.direction)
            .executeSelectMany();

        return {
            rowCount: sessions.length,
            rows: sessions.map(({ userAgent, ...session }) => ({
                ...session,
                device: formatUserAgent(userAgent),
            })),
        };
    },
});

/**
 * The <AccountLogsPage> component displays log events that were recorded by the holder of this
 * account, both through their own actions and through actions that affected them.
 */
export default async function AccountLogsPage(
    props: PageProps<'/admin/organisation/accounts/[id]/logs'>)
{
    await requireAuthentication({
        permission: 'system.logs',
        operation: 'read',
    });

    const { id } = await props.params;

    const userId = parseInt(id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    const account = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(userId))
            .and(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            activated: tUsers.activated.equals(/* true= */ 1),
            restricted: tUsers.participationSuspended,
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    const sessionColumns: Column<ExtractRowModel<typeof accountSessionsDataSource>>[] = [
        {
            field: 'created',
            headerName: 'Signed in',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'lastSeen',
            headerName: 'Last seen',
            width: 185,

            template: 'date',
            templateProps: {
                defaultValue: 'Unknown',
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'device',
            headerName: 'Device',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                defaultValue: 'Unknown',
            },
        },
        {
            field: 'ipAddress',
            headerName: 'IP address',
            flex: 1,

            template: 'text',
            templateProps: {
                defaultValue: 'Unknown',
                href: '/admin/system/diagnostics/ip/{ipAddress}',
            },
        },
        {
            field: 'impersonator',
            headerName: 'Impersonator',
            flex: 1,

            template: 'account',
            templateProps: {
                noAccountLabel: '—',
            },
        },
    ];

    return (
        <>
            <Section icon={ <InfoOutlinedIcon color="primary" /> } title="Logs"
                     headerAction={
                         <AccountStatusButton activated={account.activated}
                                              restricted={account.restricted} />
                     }
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Accounts', href: '/admin/organisation/accounts' },
                         { label: account.name, href: `/admin/organisation/accounts/${account.id}` },
                         { label: 'Logs' },
                     ]}>
                <SectionIntroduction>
                    Actions involving {account.name} on the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <LogsDataTable pageSize={25} userId={account.id} />
            </Section>
            <Section icon={ <DevicesIcon /> } title="Active sessions">
                <SectionIntroduction>
                    Devices on which {account.name} is currently signed in. Deleting a session will
                    immediately sign them out on that device.
                </SectionIntroduction>
                <DataTable
                    columns={sessionColumns}
                    context={{ userId: account.id }}
                    defaultSort={{ field: 'lastSeen', sort: 'desc' }}
                    disableFooter disableQueryParams disableSearch
                    pageSize={50}
                    source={accountSessionsDataSource}
                    subject="session"
                    listViewProps={{
                        primaryField: 'device',
                        secondaryField: 'ipAddress',
                        dateField: 'lastSeen',
                        dateFieldFormat: 'YYYY-MM-DD',
                    }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Logs', { user: 'id' }, 'Accounts', 'Organisation');
