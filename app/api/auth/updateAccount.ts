// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogType } from '@lib/Log';
import { Temporal, formatDate } from '@lib/Temporal';
import db, { tUsers } from '@lib/database';

import { kCommunicationLanguage } from '@lib/database/Types';

/**
 * Fields that describe the identifyable information stored with a volunteer's profile.
 */
export const kAccountFields = z.object({
    /**
     * The volunteer's first name.
     */
    firstName: z.string(),

    /**
     * The volunteer's last name.
     */
    lastName: z.string(),

    /**
     * The volunteer's username. Must be unique, even after being updated.
     */
    username: z.string().optional(),

    /**
     * The volunteer's gender. Arbitrary string.
     */
    gender: z.string(),

    /**
     * Date on which the user was born. (YYYY-MM-DD)
     */
    birthdate: z.string().regex(/^[1|2](\d{3})\-(\d{2})-(\d{2})$/).optional(),

    /**
     * Phone number of the user, in an undefined format.
     */
    phoneNumber: z.string().optional(),

    /**
     * Discord handle owned by the user, when provided, in an undefined format.
     */
    discordHandle: z.string().optional(),

    /**
     * Preferred language in which we should communicate with them.
     */
    language: z.enum(kCommunicationLanguage).optional(),
});

/**
 * Interface definition for the UpdateAccount API, exposed through /api/auth/update-account.
 */
export const kUpdateAccountDefinition = z.object({
    request: z.object({
        /**
         * The update
         */
        update: kAccountFields.optional(),
    }),
    response: z.strictObject({
        /**
         * Whether the sign out operation could be completed successfully.
         */
        success: z.boolean(),

        /**
         * Optional error message in case `success` is set to false.
         */
        error: z.string().optional(),

        /**
         * The volunteer's account fields, when retrieving information.
         */
        account: kAccountFields.optional(),
    }),
});

export type UpdateAccountDefinition = ApiDefinition<typeof kUpdateAccountDefinition>;

type Request = ApiRequest<typeof kUpdateAccountDefinition>;
type Response = ApiResponse<typeof kUpdateAccountDefinition>;

/**
 * API that allows a user to update their account.
 */
export async function updateAccount(request: Request, props: ActionProps): Promise<Response> {
    if (!props.user)
        return forbidden();

    const dbInstance = db;

    const account = await dbInstance.selectFrom(tUsers)
        .where(tUsers.userId.equals(props.user.id))
        .select({
            firstName: tUsers.firstName,
            lastName: tUsers.lastName,
            username: tUsers.username,
            language: tUsers.language,
            gender: tUsers.gender,
            birthdate: tUsers.birthdate,
            phoneNumber: tUsers.phoneNumber,
            discordHandle: tUsers.discordHandle,
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    // (1) Information retrieval API.
    if (!request.update) {
        return {
            success: true,
            account: {
                ...account,
                birthdate: account.birthdate ? formatDate(account.birthdate, 'YYYY-MM-DD')
                                             : undefined,
            }
        };
    }

    // (2) Information update API.
    const { update } = request;

    if (!update.firstName.length)
        return { success: false, error: 'You need to fill in your first name.' };
    if (!update.lastName.length)
        return { success: false, error: 'You need to fill in your last name.' };
    if (!update.gender.length)
        return { success: false, error: 'You need to fill in your gender.' };
    if (update.birthdate?.length !== 10)
        return { success: false, error: 'You need to fill in your date of birth.' };
    if (!update.phoneNumber || update.phoneNumber.length < 8)
        return { success: false, error: 'You need to fill in your phone number.' };

    const discordHandleUpdated =
        (account.discordHandle !== update.discordHandle && !!update.discordHandle)
            ? dbInstance.currentZonedDateTime()
            : null;

    await dbInstance.update(tUsers)
        .set({
            firstName: update.firstName,
            lastName: update.lastName,
            language: update.language ?? null,
            gender: update.gender,
            birthdate: Temporal.PlainDate.from(update.birthdate),
            phoneNumber: update.phoneNumber,
            discordHandle: update.discordHandle,
            discordHandleUpdated,
        })
        .where(tUsers.userId.equals(props.user.id))
        .executeUpdate();

    RecordLog({
        type: kLogType.AccountUpdate,
        sourceUser: props.user,
        data: {
            ip: props.ip,
            ...account
        },
    });

    return { success: true };
}
