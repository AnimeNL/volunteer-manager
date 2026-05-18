// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { MessageStatus } from 'twilio/lib/rest/api/v2010/account/message';
import type { NextRequest } from 'next/server';

import { authenticateAndRecordTwilioRequest } from '../authenticateAndRecordTwilioRequest';
import db, { tOutboxTwilio } from '@lib/database';

import { kTwilioWebhookEndpoint } from '@lib/database/Types';

/**
 * Priority of the status values from Twilio, where a higher priority is more progressive or final.
 */
const kTwilioStatusPrecedence: Record<MessageStatus, number> = {
    'accepted': 1,
    'queued': 2,
    'sending': 3,
    'sent': 4,
    'receiving': 5,
    'received': 6,
    'scheduled': 7,
    'partially_delivered': 8,
    'delivered': 9,
    'canceled': 10,
    'read': 11,
    'failed': 12,
    'undelivered': 13,
};

/**
 * Returns the precedence of the given Twilio status string.
 */
function getPrecedence(status?: string | null): number {
    if (!status)
        return 0;

    const normalisedStatus = status.toLowerCase();
    return kTwilioStatusPrecedence[normalisedStatus as MessageStatus] ?? 0;
}

/**
 * Webhook invoked when the status of an outbound message has been updated. This may happen minutes,
 * sometimes even hours after sending the message, so we need to keep our stored state in sync.
 */
export async function POST(request: NextRequest) {
    const { authenticated, body } =
        await authenticateAndRecordTwilioRequest(request, kTwilioWebhookEndpoint.Outbound);

    if (!authenticated || !body) {
        return new Response(undefined, {
            status: /* HTTP Forbidden= */ 403,
        });
    }

    const from = body.get('From');
    const messageSid = body.get('MessageSid');
    const messageStatus = body.get('MessageStatus');

    if (!!from && !!messageSid && !!messageStatus) {
        const normalisedFrom = from.replace(/.*\:/, '');  // whatsapp:+44... -> +44...

        const currentResult = await db.selectFrom(tOutboxTwilio)
            .where(tOutboxTwilio.outboxResultSid.equals(messageSid))
            .select({
                status: tOutboxTwilio.outboxResultStatus,
            })
            .executeSelectNoneOrOne();

        const currentStatus = currentResult?.status;
        if (!currentResult || getPrecedence(messageStatus) >= getPrecedence(currentStatus)) {
            await db.update(tOutboxTwilio)
                .set({
                    outboxSender: normalisedFrom,
                    outboxResultStatus: messageStatus
                })
                .where(tOutboxTwilio.outboxResultSid.equals(messageSid))
                .executeUpdate();
        }
    }

    return new Response(undefined, {
        status: /* HTTP OK= */ 200,
    });
}

export const dynamic = 'force-dynamic';
