// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { executeAccessCheck, type AuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tTwilioWebhookCalls } from '@lib/database';

import { WebhookAuthenticatedCell, WebhookAuthenticatedHeader, WebhookServiceCell, WebhookSizeCell }
    from './WebhookRowComponents';

/**
 * Data source through which received webhook calls can be retrieved.
 */
const webhookDataSource = createDataSource('admin/system/webhooks', withContext({
    /**
     * Filter for Twilio webhooks to filter by a particular message SID.
     */
    twilioMessageSid: z.string().optional(),

}), withRowModel({
    /**
     * Unique ID of the call.
     */
    id: z.number(),

    /**
     * Date at which the webhook was received by our server.
     */
    date: z.string(),

    /**
     * The service for which a message was received.
     */
    service: z.string(),

    /**
     * IP address from which the message was received.
     */
    source: z.string().optional(),

    /**
     * Destination, i.e. where was the webhook sent to?
     */
    destination: z.string(),

    /**
     * Size, in bytes, of the received message.
     */
    size: z.number(),

    /**
     * Whether the message was successfully authenticated.
     */
    authenticated: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.outbox',
        });
    },

    async list(params, props, context) {
        let sortField: 'date' | 'service' | 'source' | 'destination' | 'size' = 'date';
        switch (params.sort.field) {
            case 'date':
            case 'service':
            case 'source':
            case 'destination':
            case 'size':
                sortField = params.sort.field as any;
                break;
        }

        const dbInstance = db;
        const data = await dbInstance.selectFrom(tTwilioWebhookCalls)
            .where(tTwilioWebhookCalls.webhookMessageSid.equalsIfValue(context.twilioMessageSid))
                .or(tTwilioWebhookCalls.webhookMessageOriginalSid.equalsIfValue(
                    context.twilioMessageSid))
                .or(tTwilioWebhookCalls.webhookRequestSource.containsInsensitiveIfValue(params.search))
                .or(tTwilioWebhookCalls.webhookRequestUrl.containsInsensitiveIfValue(params.search))
            .select({
                id: tTwilioWebhookCalls.webhookCallId,
                date: dbInstance.dateTimeAsString(tTwilioWebhookCalls.webhookCallDate),
                service: dbInstance.const('twilio', 'string'),
                source: tTwilioWebhookCalls.webhookRequestSource,
                destination: tTwilioWebhookCalls.webhookRequestUrl,
                size: tTwilioWebhookCalls.webhookRequestBody.length(),
                authenticated: tTwilioWebhookCalls.webhookRequestAuthenticated.equals(/* true= */ 1),
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: data.count,
            rows: data.data.map(row => ({
                ...row,
                destination: new URL(row.destination).pathname,
            })),
        };
    },
});

/**
 * Props accepted by the <WebhookDataTable> component.
 */
interface WebhookDataTableProps {
    /**
     * Authentication context representing the signed in user.
     */
    authenticationContext: AuthenticationContext;

    /**
     * Filter for Twilio webhooks to filter by a particular message SID.
     */
    twilioMessageSid?: string;
}

/**
 * The <WebhookDataTable> component displays all webhook calls received by the Volunteer Manager.
 * Each links through to a detailed page with all information regarding that particular webhook.
 */
export function WebhookDataTable(props: WebhookDataTableProps) {
    const columns: Column<ExtractRowModel<typeof webhookDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: '/admin/system/webhooks/{service}/{id}',
            },
        },
        {
            field: 'service',
            headerName: 'Service',
            width: 75,

            template: 'component',
            templateProps: {
                component: WebhookServiceCell,
            },
        },
        {
            field: 'source',
            headerName: 'Source IP',
            flex: 2,
        },
        {
            field: 'destination',
            headerName: 'Destination',
            flex: 4,
        },
        {
            field: 'size',
            headerName: 'Size',
            flex: 2,

            template: 'component',
            templateProps: {
                component: WebhookSizeCell,
            },
        },
        {
            display: 'flex',
            field: 'authenticated',
            headerAlign: 'center',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: WebhookAuthenticatedHeader,
                component: WebhookAuthenticatedCell,
            },
        },
    ];

    return (
        <DataTable
            columns={columns}
            source={webhookDataSource.authorize(props.authenticationContext, props)}
            context={props}
            defaultSort={{ field: 'date', sort: 'desc' }}
            disableQueryParams={!!props.twilioMessageSid}
            disableFooter={!!props.twilioMessageSid}
            pageSize={50}
            listViewProps={{
                primaryField: 'destination',
                secondaryField: 'source',
                dateField: 'date',
                dateFieldFormat: 'YYYY-MM-DD',
                startComponent: WebhookAuthenticatedCell,
                linkTemplate: '/admin/system/webhooks/{service}/{id}',
            }}
        />
    );
}
