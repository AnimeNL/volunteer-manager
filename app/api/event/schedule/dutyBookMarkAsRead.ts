// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { unauthorized } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../../Types';
import db, { tDutyBookViewers } from '@lib/database';

/**
 * Interface definition for the Duty Book API, exposed through /api/event/schedule/duty-book
 */
export const kDutyBookMarkAsReadDefinition = z.object({
    request: z.object({
        /**
         * Unique ID of the duty book entry that they have read.
         */
        id: z.number(),
    }),
    response: z.strictObject({
        /**
         * Whether the entry was marked as read.
         */
        success: z.boolean(),
    }),
});

export type DutyBookMarkAsReadDefinition = ApiDefinition<typeof kDutyBookMarkAsReadDefinition>;

type Request = ApiRequest<typeof kDutyBookMarkAsReadDefinition>;
type Response = ApiResponse<typeof kDutyBookMarkAsReadDefinition>;

/**
 * API through which it's reported that a volunteer has read a Duty Book entry.
 */
export async function dutyBookMarkAsRead(request: Request, props: ActionProps): Promise<Response> {
    if (!props.user || !props.authenticationContext.user)
        unauthorized();

    const dbInstance = db;
    await dbInstance.insertInto(tDutyBookViewers)
        .values({
            dutyBookId: request.id,
            dutyBookViewerUserId: props.user.id,
            dutyBookViewerDate: dbInstance.currentZonedDateTime(),
        })
        .onConflictDoNothing()
        .executeInsert();

    return { success: true };
}
