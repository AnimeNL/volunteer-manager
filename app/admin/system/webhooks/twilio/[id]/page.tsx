// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CodeIcon from '@mui/icons-material/Code';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import WebhookIcon from '@mui/icons-material/Webhook';

import type { TwilioOutboxType } from '@lib/database/Types';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TwilioIcon } from '@app/admin/components/icons/TwilioIcon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tOutboxTwilio, tTwilioWebhookCalls } from '@lib/database';

/**
 * Creates a link through which the outbox for the given `id` can be reached.
 */
function createOutboxLink(info?: { id?: number; type?: TwilioOutboxType }): string {
    if (!info || !info.id || !info.type)
        return '#';  // this shouldn't happen

    return `/admin/system/outbox/${info.type.toLowerCase()}/${info.id}`;
}

/**
 * The webhooks page for Twilio messages details all information known about a particular message we
 * received from, you guessed it, Twilio. These generally are SMS and WhatsApp messages.
 */
export default async function TwilioWebhooksPage(
    props: PageProps<'/admin/system/webhooks/twilio/[id]'>)
{
    await requireAuthentication('system.internals.outbox');

    const params = await props.params;

    const webhookId = parseInt(params.id, 10);
    if (!Number.isSafeInteger(webhookId))
        notFound();

    const messageJoin = tOutboxTwilio.forUseInLeftJoinAs('mj');
    const originalMessageJoin = tOutboxTwilio.forUseInLeftJoinAs('omj');

    const webhook = await db.selectFrom(tTwilioWebhookCalls)
        .leftJoin(messageJoin)
            .on(messageJoin.outboxResultSid.equals(tTwilioWebhookCalls.webhookMessageSid))
        .leftJoin(originalMessageJoin)
            .on(originalMessageJoin.outboxResultSid.equals(
                tTwilioWebhookCalls.webhookMessageOriginalSid))
        .where(tTwilioWebhookCalls.webhookCallId.equals(webhookId))
        .select({
            date: tTwilioWebhookCalls.webhookCallDate,
            endpoint: tTwilioWebhookCalls.webhookCallEndpoint,

            message: {
                id: messageJoin.outboxTwilioId,
                type: messageJoin.outboxType,
                sid: tTwilioWebhookCalls.webhookMessageSid,
            },

            originalMessage: {
                id: originalMessageJoin.outboxTwilioId,
                type: originalMessageJoin.outboxType,
                sid: tTwilioWebhookCalls.webhookMessageOriginalSid,
            },

            requestSource: tTwilioWebhookCalls.webhookRequestSource,
            requestMethod: tTwilioWebhookCalls.webhookRequestMethod,
            requestUrl: tTwilioWebhookCalls.webhookRequestUrl,
            requestHeaders: tTwilioWebhookCalls.webhookRequestHeaders,
            requestBody: tTwilioWebhookCalls.webhookRequestBody,

            requestSignature: tTwilioWebhookCalls.webhookRequestSignature,
            requestAuthenticated:
                tTwilioWebhookCalls.webhookRequestAuthenticated.equals(/* true= */ 1),

            errorName: tTwilioWebhookCalls.webhookErrorName,
            errorCause: tTwilioWebhookCalls.webhookErrorCause,
            errorMessage: tTwilioWebhookCalls.webhookErrorMessage,
            errorStack: tTwilioWebhookCalls.webhookErrorStack,
        })
        .executeSelectNoneOrOne();

    if (!webhook)
        notFound();

    const headers = JSON.parse(webhook.requestHeaders) as [ string, string ][];
    const body = new URLSearchParams(webhook.requestBody);

    return (
        <>
            <Section icon={ <TwilioIcon /> } title={`Twilio #${params.id}`} breadcrumbs={[
                            { label: 'Communication', href: '/admin/system/communication' },
                            { label: 'Webhooks', href: '/admin/system/webhooks' },
                            { label: `Twilio #${params.id}` }
                        ]}>
                <SectionIntroduction>
                    Detailed information about a webhook call received from{' '}
                    <MuiLink component={Link} href="https://twilio.com" target="_blank">
                        Twilio
                    </MuiLink>.
                </SectionIntroduction>
            </Section>
            <Section icon={ <WebhookIcon /> } title="Webhook">
                <KeyValueList items={[
                    {
                        key: 'Date',
                        value: webhook.date.toString(),
                        valueTemplate: 'localDateTime',
                    },
                    {
                        description: 'Whether Twilio\'s signature could be validated.',
                        keyAlign: 'center',
                        key: 'Authentication',
                        value: (
                            <>
                                { !!webhook.requestAuthenticated &&
                                    <Chip label="authenticated" size="small"
                                            color="success" component="span" /> }
                                { !webhook.requestAuthenticated &&
                                    <Chip label="unauthenticated" size="small"
                                            color="error" component="span" /> }
                            </>
                        ),
                    },
                    {
                        key: 'Endpoint',
                        value: webhook.endpoint,
                    },
                    {
                        condition: !!webhook.message?.id,
                        key: 'Message',
                        value: (
                            <MuiLink component={Link} href={ createOutboxLink(webhook.message) }>
                                {webhook.message?.sid}
                            </MuiLink>
                        ),
                    },
                    {
                        condition: !!webhook.originalMessage?.id,
                        key: 'Response to',
                        value: (
                            <MuiLink component={Link}
                                     href={ createOutboxLink(webhook.originalMessage) }>
                                {webhook.originalMessage?.sid}
                            </MuiLink>
                        ),
                    },
                    {
                        condition: !!webhook.requestSource,
                        description: 'IP address from which the message was received.',
                        key: 'Request source',
                        value: webhook.requestSource,
                    },
                    {
                        key: 'Request method',
                        value: webhook.requestMethod,
                    },
                    {
                        key: 'Request URL',
                        value: URL.canParse(webhook.requestUrl)
                            ? new URL(webhook.requestUrl).pathname
                            : webhook.requestUrl,
                    }
                ]} />
            </Section>
            <Section icon={ <CodeIcon /> } title="Headers">
                <KeyValueList items={ headers.map(([ name, value ]) => ({
                    key: name,
                    value,
                    valueTemplate: 'monospace',
                })) } />
            </Section>
            <Section icon={ <FormatListBulletedIcon /> } title="Parameters">
                <KeyValueList items={ [ ...body.entries() ].map(([ name, value ]) => ({
                    key: name,
                    value,
                    valueTemplate: 'monospace',
                })) } />
            </Section>
            { !!webhook.errorName &&
                <Section icon={ <ErrorOutlinedIcon /> } title="Error">
                    <Alert severity="error">
                        An exception occurred when handling this webhook.
                    </Alert>
                    <KeyValueList items={[
                        {
                            key: 'Name',
                            value: webhook.errorName,
                        },
                        {
                            key: 'Message',
                            value: webhook.errorMessage,
                        },
                        {
                            condition: !!webhook.errorCause,
                            key: 'Cause',
                            value: webhook.errorCause,
                            valueTemplate: 'monospace',
                        },
                        {
                            key: 'Stack',
                            value: webhook.errorStack,
                            valueTemplate: 'monospace',
                        },
                    ]} />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'Twilio', 'Webhooks', 'Communication');
