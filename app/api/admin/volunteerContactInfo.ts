// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents, tEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';
/**
 * Interface definition for the Volunteer API, exposed through /api/admin/volunteer-contact-info.
 */
export const kVolunteerContactInfoDefinition = z.object({
    request: z.object({
        /**
         * Slug of the event for which this information is being requested.
         */
        event: z.string(),

        /**
         * ID of the team for which this information is being requested.
         */
        teamId: z.number(),

        /**
         * ID of the user whose contact information is being requested.
         */
        userId: z.number(),
    }),
    response: z.strictObject({
        /**
         * The username (e-mail address) owned by this volunteer.
         */
        username: z.string().optional(),

        /**
         * The phone number through which we can reach this volunteer.
         */
        phoneNumber: z.string().optional(),
    }),
});

export type VolunteerContactInfoDefinition = ApiDefinition<typeof kVolunteerContactInfoDefinition>;

type Request = ApiRequest<typeof kVolunteerContactInfoDefinition>;
type Response = ApiResponse<typeof kVolunteerContactInfoDefinition>;

/**
 * API that allows event administrators and senior volunteers in particular events to retrieve the
 * contact information of certain volunteers. Access to this information is recorded.
 */
export async function volunteerContactInfo(request: Request, props: ActionProps)
    : Promise<Response>
{
    await requireAuthentication(props.authenticationContext);

    const contactInformation = await db.selectFrom(tUsers)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.userId.equals(tUsers.userId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .and(tEvents.eventSlug.equals(request.event))
        .where(tUsers.userId.equals(request.userId))
        .select({
            username: tUsers.username,
            phoneNumber: tUsers.phoneNumber,
        })
        .executeSelectNoneOrOne();

    if (contactInformation) {
        RecordLog({
            type: kLogType.AdminAccessVolunteerInfo,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            targetUser: request.userId,
            data: {
                ip: props.ip,
            }
        });
    }

    return contactInformation ?? { /* empty response */ };
}
