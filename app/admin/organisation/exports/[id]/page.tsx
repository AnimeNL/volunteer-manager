// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import Alert from '@mui/material/Alert';
import DvrIcon from '@mui/icons-material/Dvr';

import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { ExpireExportQuickAction } from './ExpireExportQuickAction';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShareableLink } from './ShareableLink';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { determineEnvironment } from '@lib/Environment';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { isBefore } from '@lib/Temporal';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents, tExportsLogs, tExports, tUsers } from '@lib/database';

import * as actions from '../ExportsActions';

/**
 * Data source through which the access logs of a given export can be retrieved.
 */
const exportAccessLogsDataSource = createDataSource('organisation/exports/access-logs', withContext({
    /**
     * Unique ID of the export to display the access logs for.
     */
    exportId: z.number(),

}), withRowModel({
    /**
     * Unique ID of the log entry.
     */
    id: z.number(),

    /**
     * Date at which the export was accessed.
     */
    date: z.string(),

    /**
     * IP address of the user who accessed the export.
     */
    userIp: z.string(),

    /**
     * User agent of the client that accessed the export.
     */
    userAgent: z.string(),

    /**
     * Volunteer who accessed the export, if authenticated.
     */
    user: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),
}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'organisation.exports');
    },

    async list(params, props, context) {
        const dbInstance = db;
        const usersJoin = tUsers.forUseInLeftJoin();
        const results = await dbInstance.selectFrom(tExportsLogs)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tExportsLogs.accessUserId))
            .where(tExportsLogs.exportId.equals(context.exportId))
            .select({
                id: tExportsLogs.exportLogId,
                date: dbInstance.dateTimeAsString(tExportsLogs.accessDate),
                userIp: tExportsLogs.accessIpAddress,
                userAgent: tExportsLogs.accessUserAgent,
                user: {
                    id: tExportsLogs.accessUserId,
                    name: usersJoin.name,
                },
            })
            .orderBy(
                params.sort.field === 'user' ? 'user.name'
                    : params.sort.field === 'userIp' ? 'userIp'
                    : params.sort.field === 'userAgent' ? 'userAgent'
                    : 'date',
                params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data.map(row => ({
                ...row,
                user: (row.user && row.user.id && row.user.name) ? row.user as any : undefined,
            })),
        };
    },
});

/**
 * The <OrganisationExportsLogPage> component displays the information associated with a singular
 * data export entry, with a focus on the motivation and access logs.
 */
export default async function OrganisationExportsLogPage(
    props: PageProps<'/admin/organisation/exports/[id]'>)
{
    const { access } = await requireAuthentication('organisation.exports');

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const { id } = await props.params;

    const exportId = parseInt(id, /* radix= */ 10);
    if (!Number.isSafeInteger(exportId))
        notFound();

    const exportsLogsJoin = tExportsLogs.forUseInLeftJoin();

    const dbInstance = db;
    const data = await dbInstance.selectFrom(tExports)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tExports.exportEventId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tExports.exportCreatedUserId))
        .leftJoin(exportsLogsJoin)
            .on(exportsLogsJoin.exportId.equals(tExports.exportId))
        .where(tExports.exportId.equals(exportId))
        .select({
            id: tExports.exportId,
            date: dbInstance.dateTimeAsString(tExports.exportCreatedDate),
            slug: tExports.exportSlug,
            type: tExports.exportType,
            eventName: tEvents.eventShortName,
            enabled: tExports.exportEnabled,
            expirationDate: tExports.exportExpirationDate,
            expirationViews: tExports.exportExpirationViews,
            justification: tExports.exportJustification,
            userId: tExports.exportCreatedUserId,
            userName: tUsers.name,
            views: dbInstance.count(exportsLogsJoin.accessDate),
        })
        .groupBy(tExports.exportId)
        .executeSelectNoneOrOne();

    if (!data)
        notFound();

    const active =
        data.enabled &&
        data.expirationViews > data.views &&
        isBefore(Temporal.Now.zonedDateTimeISO(), data.expirationDate);

    const expireExportFn = actions.expireExport.bind(null, data.id);
    const shareableLink = `https://${environment.domain}/exports/${data.slug}`;

    const columns: Column<ExtractRowModel<typeof exportAccessLogsDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'userIp',
            headerName: 'IP Address',
            width: 150,

            template: 'text',
            templateProps: {
                href: access.can('system.logs', 'read')
                    ? '/admin/system/diagnostics/ip/{userIp}'
                    : undefined,
            },
        },
        {
            field: 'userAgent',
            headerName: 'User Agent',
            flex: 1,
        },
        {
            field: 'user',
            headerName: 'Volunteer',
            width: 200,

            template: 'account',
            templateProps: {
                noAccountLabel: 'unknown',
            },
        },
    ];

    return (
        <>
            <Section icon={ <AccountBalanceIcon color="primary" /> }
                     title={`${data.eventName} ${data.type}`}
                     documentation="organisation/exports"
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Data exports', href: '/admin/organisation/exports' },
                         { label: 'Logs', href: '/admin/organisation/exports' },
                         { label: `${data.eventName} ${data.type}` },
                     ]}>
                <SectionIntroduction>
                    Detailed information about an export that was generated for {data.eventName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back="Back to export logs" tabs>
                { !active &&
                    <Alert severity="info" variant="outlined">
                        This export has expired and is no longer accessible.
                    </Alert> }
                <KeyValueList items={[
                    {
                        key: 'Shareable link',
                        value: <ShareableLink href={shareableLink} />,
                        valueTemplate: 'component',
                    },
                    {
                        key: 'Expiration date',
                        value: data.expirationDate.toString(),
                        valueTemplate: 'localDateTime',
                    },
                    {
                        key: 'Expiration views',
                        value: `${data.expirationViews} (seen: ${data.views})`,
                    },
                    {
                        key: 'Exported by',
                        value: {
                            id: data.userId,
                            name: data.userName,
                        },
                        valueTemplate: 'account',
                    },
                    {
                        key: 'Exported on',
                        value: data.date,
                        valueTemplate: 'localDateTime',
                    },
                    {
                        key: 'Exported data',
                        value: `${data.eventName} ${data.type}`,
                    },
                    {
                        key: 'Justification',
                        value: data.justification,
                    },
                ]} />
                { !!active && <ExpireExportQuickAction action={expireExportFn} /> }
            </Section>
            { !!data.views &&
                <Section icon={ <DvrIcon /> } title="Access logs">
                    <DataTable
                        columns={columns}
                        source={exportAccessLogsDataSource}
                        context={{ exportId: data.id }}
                        defaultSort={{ field: 'date', sort: 'desc' }}
                        pageSize={100}
                        disableSearch
                        listViewProps={{
                            primaryField: 'userIp',
                            secondaryField: 'userAgent',
                            dateField: 'date',
                            dateFieldFormat: 'YYYY-MM-DD HH:mm:ss',
                        }}
                    />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: '#' }, 'Logs', 'Data exports', 'Organisation');

