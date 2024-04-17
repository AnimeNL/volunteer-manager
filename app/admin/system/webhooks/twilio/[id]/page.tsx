// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';

import type { NextPageParams } from '@lib/NextRouterParams';
import type { TwilioOutboxType } from '@lib/database/Types';
import { Privilege } from '@lib/auth/Privileges';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { formatDate } from '@lib/Temporal';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tOutboxTwilio, tTwilioWebhookCalls } from '@lib/database';

/**
 * Creates a link through which the outbox for the given `id` can be reached.
 */
function createOutboxLink(info: { id?: number; type?: TwilioOutboxType }): string {
    if (!info.id || !info.type)
        return '#';  // this shouldn't happen

    return `/admin/system/outbox/${info.type.toLowerCase()}/${info.id}`;
}

/**
 * The webhooks page for Twilio messages details all information known about a particular message we
 * received from, you guessed it, Twilio. These generally are SMS and WhatsApp messages.
 */
export default async function TwilioWebhooksPage(props: NextPageParams<'id'>) {
    await requireAuthenticationContext({
        check: 'admin',
        privilege: Privilege.Administrator,
    });

    const messageJoin = tOutboxTwilio.forUseInLeftJoinAs('mj');
    const originalMessageJoin = tOutboxTwilio.forUseInLeftJoinAs('omj');

    const webhook = await db.selectFrom(tTwilioWebhookCalls)
        .leftJoin(messageJoin)
            .on(messageJoin.outboxResultSid.equals(tTwilioWebhookCalls.webhookMessageSid))
        .leftJoin(originalMessageJoin)
            .on(originalMessageJoin.outboxResultSid.equals(
                tTwilioWebhookCalls.webhookMessageOriginalSid))
        .where(tTwilioWebhookCalls.webhookCallId.equals(parseInt(props.params.id)))
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
            // TODO: `webhookRequestSignature`

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

    const sx = { p: 2, pb: 1 };
    return (
        <>
            <Paper>
                <SectionHeader title="Twilio webhook" subtitle={webhook.endpoint} sx={sx} />
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell width="20%" component="th" scope="row">
                                <strong>Date</strong>
                            </TableCell>
                            <TableCell>
                                { formatDate(webhook.date, 'dddd, MMMM Do [at] HH:mm:ss') }
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="20%" component="th" scope="row">
                                <strong>Endpoint</strong>
                            </TableCell>
                            <TableCell>{webhook.endpoint}</TableCell>
                        </TableRow>
                        { (!!webhook.message && !!webhook.message.id) &&
                            <TableRow>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>Message</strong>
                                </TableCell>
                                <TableCell>
                                    <MuiLink component={Link}
                                             href={ createOutboxLink(webhook.message) }>
                                        {webhook.message.sid}
                                    </MuiLink>
                                </TableCell>
                            </TableRow> }
                        { (!!webhook.originalMessage && !!webhook.originalMessage.id) &&
                            <TableRow>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>Response to</strong>
                                </TableCell>
                                <TableCell>
                                    <MuiLink component={Link}
                                             href={ createOutboxLink(webhook.originalMessage) }>
                                        {webhook.originalMessage.sid}
                                    </MuiLink>
                                </TableCell>
                            </TableRow> }
                        { !!webhook.requestSource &&
                            <TableRow>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>Request source</strong>
                                </TableCell>
                                <TableCell>{webhook.requestSource}</TableCell>
                            </TableRow> }
                        <TableRow>
                            <TableCell width="20%" component="th" scope="row">
                                <strong>Request method</strong>
                            </TableCell>
                            <TableCell>{webhook.requestMethod}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="20%" component="th" scope="row">
                                <strong>Request URL</strong>
                            </TableCell>
                            <TableCell>{new URL(webhook.requestUrl).pathname}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Paper>
            <Paper>
                <SectionHeader title="Headers" sx={sx} />
                <Table>
                    <TableBody>
                        { headers.map(([ name, value ], index) =>
                            <TableRow key={index}>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>{name}</strong>
                                </TableCell>
                                <TableCell>{value}</TableCell>
                            </TableRow> )}
                    </TableBody>
                </Table>
            </Paper>
            <Paper>
                <SectionHeader title="Parameters" sx={sx} />
                <Table>
                    <TableBody>
                        { [ ...body.entries() ].map(([ name, value ], index) =>
                            <TableRow key={index}>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>{name}</strong>
                                </TableCell>
                                <TableCell>{value}</TableCell>
                            </TableRow> )}
                    </TableBody>
                </Table>
            </Paper>
            { !!webhook.errorName &&
                <Paper>
                    <SectionHeader title="Parameters" sx={sx} />
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>Name</strong>
                                </TableCell>
                                <TableCell>{webhook.errorName}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>Message</strong>
                                </TableCell>
                                <TableCell>{webhook.errorMessage}</TableCell>
                            </TableRow>
                            { !!webhook.errorCause &&
                                <TableRow>
                                    <TableCell width="20%" component="th" scope="row">
                                        <strong>Cause</strong>
                                    </TableCell>
                                    <TableCell>{webhook.errorCause}</TableCell>
                                </TableRow> }
                            <TableRow>
                                <TableCell width="20%" component="th" scope="row">
                                    <strong>Stack</strong>
                                </TableCell>
                                <TableCell>{webhook.errorStack}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Paper> }
        </>
    );
}

export const metadata: Metadata = {
    title: 'Twilio | Webhooks | AnimeCon Volunteer Manager',
};
