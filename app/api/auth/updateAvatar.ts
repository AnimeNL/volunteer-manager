// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { LogBuilder } from '@lib/log/index';
import { RecordLog, kLogType } from '@lib/Log';
import { executeAccessCheck} from '@lib/auth/AuthenticationContext';
import { storeBlobData } from '@lib/database/BlobStore';
import db, { tUsers } from '@lib/database';

import { kFileType } from '@lib/database/Types';

/**
 * Interface definition for the UpdateAvatar API, exposed through /api/auth/update-avatar.
 */
export const kUpdateAvatarDefinition = z.object({
    request: z.object({
        /**
         * The avatar, encoded in the PNG format, represented as a string.
         */
        avatar: z.string(),

        /**
         * User ID that should be amended, if it's not the signed in user. This relies on having
         * additional permissions.
         */
        overrideUserId: z.number().optional(),
    }),
    response: z.strictObject({
        /**
         * Whether the sign out operation could be completed successfully.
         */
        success: z.boolean(),
    }),
});

export type UpdateAvatarDefinition = ApiDefinition<typeof kUpdateAvatarDefinition>;

type Request = ApiRequest<typeof kUpdateAvatarDefinition>;
type Response = ApiResponse<typeof kUpdateAvatarDefinition>;

/**
 * API that allows a user to update an avatar. In most cases this will be about their own avatar,
 * although select volunteers have the ability to update avatars belonging to other people as well.
 */
export async function updateAvatar(request: Request, props: ActionProps): Promise<Response> {
    if (!props.user)
        return forbidden();

    let subjectUserId: number = props.user.id;
    if (request.overrideUserId && request.overrideUserId !== props.user.id) {
        executeAccessCheck(props.authenticationContext, 'organisation.avatars');

        subjectUserId = request.overrideUserId;
    }

    const avatarId = await storeBlobData({
        bytes: Buffer.from(request.avatar, 'base64'),
        mimeType: 'image/png',
        type: kFileType.Avatar,
        userId: subjectUserId,
    });

    if (avatarId) {
        const affectedRows = await db.update(tUsers)
            .set({ avatarId })
            .where(tUsers.userId.equals(subjectUserId))
            .executeUpdate();

        if (!!affectedRows) {
            if (request.overrideUserId) {
                LogBuilder.for('AdminUpdateAvatar')
                    .withInitiatorUser(props.user)
                    .withAffectedUser(request.overrideUserId)
                    .withSeverity('Warning')
                    .record();
            } else {
                RecordLog({
                    type: kLogType.AccountUpdateAvatar,
                    sourceUser: props.user,
                    data: { ip: props.ip },
                });
            }

            return { success: true };
        }
    }

    return { success: false };
}
