// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tDisplays, tDisplaysRequests, tUsers } from '@lib/database';

import { kDisplayHelpRequestStatus } from '@lib/database/Types';

/**
 * Fetches the help request identified by `requestId` for `eventId`, or calls `notFound()` when no
 * matching request exists.
 */
async function fetchHelpRequest(eventId: number, requestId: number) {
    const acknowledgedUserJoin = tUsers.forUseInLeftJoinAs('auj');
    const closedUserJoin = tUsers.forUseInLeftJoinAs('cuj');

    const helpRequest = await db.selectFrom(tDisplaysRequests)
        .innerJoin(tDisplays)
            .on(tDisplays.displayId.equals(tDisplaysRequests.displayId))
        .leftJoin(acknowledgedUserJoin)
            .on(acknowledgedUserJoin.userId.equals(tDisplaysRequests.requestAcknowledgedBy))
        .leftJoin(closedUserJoin)
            .on(closedUserJoin.userId.equals(tDisplaysRequests.requestClosedBy))
        .where(tDisplaysRequests.requestId.equals(requestId))
            .and(tDisplaysRequests.requestEventId.equals(eventId))
        .select({
            display: tDisplays.displayLabel.valueWhenNull(tDisplays.displayIdentifier),
            displayId: tDisplays.displayId,
            acknowledgedBy: acknowledgedUserJoin.name,
            closedBy: closedUserJoin.name,
        })
        .executeSelectNoneOrOne();

    if (!helpRequest)
        notFound();

    return helpRequest;
}

/**
 * Zod type that describes the data required when acknowledging a help request.
 */
const kAcknowledgeHelpRequestData = z.object({
    /**
     * Unique slug of the event to which the help request belongs.
     */
    event: z.string().nonempty(),

    /**
     * Unique ID of the help request that is to be acknowledged.
     */
    requestId: z.number(),
});

/**
 * Server Action through which a volunteer can acknowledge an open help request.
 */
export async function acknowledgeHelpRequest(formData: unknown) {
    return executeServerAction(formData, kAcknowledgeHelpRequestData, async (data, props) => {
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event, 'event.help-requests');

        const helpRequest = await fetchHelpRequest(event.id, data.requestId);
        if (!!helpRequest.acknowledgedBy) {
            return {
                success: false,
                error: `${helpRequest.acknowledgedBy} is already on their way!`,
            };
        }

        const dbInstance = db;
        await dbInstance.transaction(async () => {
            await dbInstance.update(tDisplays)
                .set({
                    displayHelpRequestStatus: kDisplayHelpRequestStatus.Acknowledged,
                })
                .where(tDisplays.displayId.equals(helpRequest.displayId))
                .executeUpdate();

            await dbInstance.update(tDisplaysRequests)
                .set({
                    requestAcknowledgedBy: props.user.id,
                    requestAcknowledgedDate: dbInstance.currentZonedDateTime(),
                })
                .where(tDisplaysRequests.requestId.equals(data.requestId))
                .executeUpdate();
        });

        LogBuilder.for('UpdateHelpRequest')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                display: helpRequest.display,
                event: event.shortName,
                mutation: 'Acknowledged',
            });

        return { success: true };
    });
}

/**
 * Zod type that describes the data required when closing a help request.
 */
const kCloseHelpRequestData = z.object({
    /**
     * Unique slug of the event to which the help request belongs.
     */
    event: z.string().nonempty(),

    /**
     * Unique ID of the help request that is to be closed.
     */
    requestId: z.number(),

    /**
     * The reason with which the request should be closed.
     */
    reason: z.string().min(5),
});

/**
 * Server Action through which a volunteer can close a help request.
 */
export async function closeHelpRequest(formData: unknown) {
    return executeServerAction(formData, kCloseHelpRequestData, async (data, props) => {
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event, 'event.help-requests');

        const helpRequest = await fetchHelpRequest(event.id, data.requestId);
        if (!!helpRequest.closedBy) {
            return {
                success: false,
                error: `${helpRequest.closedBy} has already closed the request!`,
            };
        }

        const dbInstance = db;
        await dbInstance.transaction(async () => {
            await dbInstance.update(tDisplays)
                .set({
                    displayHelpRequestStatus: /* reset= */ null,
                })
                .where(tDisplays.displayId.equals(helpRequest.displayId))
                .executeUpdate();

            await dbInstance.update(tDisplaysRequests)
                .set({
                    requestClosedBy: props.user.id,
                    requestClosedDate: dbInstance.currentZonedDateTime(),
                    requestClosedReason: data.reason,
                })
                .where(tDisplaysRequests.requestId.equals(data.requestId))
                .executeUpdate();
        });

        LogBuilder.for('UpdateHelpRequest')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                display: helpRequest.display,
                event: event.shortName,
                mutation: 'Closed',
            });

        return { success: true };
    });
}
