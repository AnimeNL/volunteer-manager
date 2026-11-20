// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { RecordLog, kLogType } from '@lib/Log';
import { executeAccessCheck, invalidateUserAuthCache, requireAuthenticationContext }
    from './AuthenticationContext';
import { formatDate } from '@lib/Temporal';
import { getAuthRequestMetadata } from './AuthHelpers';
import { storeBlobData } from '@lib/database/BlobStore';
import db, { tUsers } from '@lib/database';

import { kCommunicationLanguage, kFileType } from '@lib/database/Types';

/**
 * Maximum permitted avatar upload size (5 MiB).
 */
const kMaxAvatarBytes = 5 * 1024 * 1024;

/**
 * Standard 8-byte PNG file signature.
 */
const kPngSignature = [ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ] as const;

const kOwnAccountFields = z.object({
    firstName: z.string(),
    lastName: z.string(),
    username: z.string().optional(),
    gender: z.string(),
    birthdate: z.string().regex(/^[1|2](\d{3})-(\d{2})-(\d{2})$/).optional(),
    phoneNumber: z.string().optional(),
    discordHandle: z.string().optional(),
    language: z.enum(kCommunicationLanguage).optional(),
});

/**
 * Editable profile fields for the signed-in volunteer.
 */
export type OwnAccountFields = z.infer<typeof kOwnAccountFields>;

/**
 * Result returned by `getOwnAccountAction()`.
 */
export interface GetOwnAccountResult {
    success: boolean;
    error?: string;
    account?: OwnAccountFields;
}

/**
 * Result returned by `updateOwnAccountAction()` and `updateAvatarAction()`.
 */
export interface ProfileMutationResult {
    success: boolean;
    error?: string;
}

/**
 * Returns whether `bytes` begins with a valid PNG file signature.
 */
function hasPngSignature(bytes: Uint8Array): boolean {
    if (bytes.byteLength < kPngSignature.length)
        return false;

    for (let index = 0; index < kPngSignature.length; ++index) {
        if (bytes[index] !== kPngSignature[index])
            return false;
    }

    return true;
}

/**
 * Retrieves the signed-in user's own account profile fields.
 */
export async function getOwnAccountAction(): Promise<GetOwnAccountResult> {
    const { user } = await requireAuthenticationContext();

    const account = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(user.id))
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

    return {
        success: true,
        account: {
            ...account,
            birthdate: account.birthdate ? formatDate(account.birthdate, 'YYYY-MM-DD') : undefined,
        },
    };
}

/**
 * Updates the signed-in user's own profile fields and invalidates their auth cache.
 */
export async function updateOwnAccountAction(
    input: OwnAccountFields): Promise<ProfileMutationResult>
{
    const { user } = await requireAuthenticationContext();
    const parsed = kOwnAccountFields.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Please check the account information you entered.' };

    const update = parsed.data;
    if (!update.firstName.trim().length)
        return { success: false, error: 'You need to fill in your first name.' };
    if (!update.lastName.trim().length)
        return { success: false, error: 'You need to fill in your last name.' };
    if (!update.gender.trim().length)
        return { success: false, error: 'You need to fill in your gender.' };
    if (update.birthdate?.length !== 10)
        return { success: false, error: 'You need to fill in your date of birth.' };
    if (!update.phoneNumber || update.phoneNumber.length < 8)
        return { success: false, error: 'You need to fill in your phone number.' };

    const dbInstance = db;
    const existing = await dbInstance.selectFrom(tUsers)
        .where(tUsers.userId.equals(user.id))
        .select({
            firstName: tUsers.firstName,
            lastName: tUsers.lastName,
            username: tUsers.username,
            language: tUsers.language,
            gender: tUsers.gender,
            birthdate: tUsers.birthdate,
            phoneNumber: tUsers.phoneNumber,
            discordHandle: tUsers.discordHandle,
            discordHandleUpdated: tUsers.discordHandleUpdated,
        })
        .executeSelectNoneOrOne();

    if (!existing)
        notFound();

    const normalizedDiscord = update.discordHandle?.trim() || null;
    const discordHandleUpdated = existing.discordHandle !== normalizedDiscord
        ? (normalizedDiscord ? dbInstance.currentZonedDateTime() : null)
        : existing.discordHandleUpdated;

    await dbInstance.update(tUsers)
        .set({
            firstName: update.firstName.trim(),
            lastName: update.lastName.trim(),
            language: update.language ?? null,
            gender: update.gender.trim(),
            birthdate: Temporal.PlainDate.from(update.birthdate),
            phoneNumber: update.phoneNumber,
            discordHandle: normalizedDiscord,
            discordHandleUpdated,
        })
        .where(tUsers.userId.equals(user.id))
        .executeUpdate();

    invalidateUserAuthCache(user.id);

    const meta = await getAuthRequestMetadata();
    RecordLog({
        type: kLogType.AccountUpdate,
        sourceUser: user,
        data: { ip: meta.ip, ...existing },
    });

    return { success: true };
}

/**
 * Updates an avatar from a `FormData` payload containing a PNG `avatar` blob and an optional
 * `overrideUserId` (requiring `organisation.avatars` permission when updating another user).
 */
export async function updateAvatarAction(formData: FormData): Promise<ProfileMutationResult> {
    const context = await requireAuthenticationContext();

    const avatarEntry = formData.get('avatar');
    if (!(avatarEntry instanceof Blob) || avatarEntry.size <= 0 ||
        avatarEntry.size > kMaxAvatarBytes)
    {
        return { success: false, error: 'Please provide a valid PNG avatar image.' };
    }

    let subjectUserId = context.user.id;
    let isOverride = false;

    const overrideEntry = formData.get('overrideUserId');
    if (overrideEntry !== null && String(overrideEntry).length > 0) {
        const overrideUserId = Number(overrideEntry);
        if (!Number.isInteger(overrideUserId) || overrideUserId <= 0)
            return { success: false, error: 'Invalid user identifier.' };

        if (overrideUserId !== context.user.id) {
            executeAccessCheck(context, 'organisation.avatars');
            subjectUserId = overrideUserId;
            isOverride = true;
        }
    }

    const bytes = new Uint8Array(await avatarEntry.arrayBuffer());
    if (!hasPngSignature(bytes))
        return { success: false, error: 'Avatar uploads must be in PNG format.' };

    const avatarId = await storeBlobData({
        bytes,
        mimeType: 'image/png',
        type: kFileType.Avatar,
        userId: subjectUserId,
    });

    if (!avatarId)
        return { success: false };

    const affectedRows = await db.update(tUsers)
        .set({ avatarId })
        .where(tUsers.userId.equals(subjectUserId))
        .executeUpdate();

    if (!affectedRows)
        return { success: false };

    invalidateUserAuthCache(subjectUserId);

    if (isOverride) {
        LogBuilder.for('AdminUpdateAvatar')
            .withInitiatorUser(context.user)
            .withAffectedUser(subjectUserId)
            .withSeverity('Warning')
            .record();
    } else {
        const meta = await getAuthRequestMetadata();
        RecordLog({
            type: kLogType.AccountUpdateAvatar,
            sourceUser: context.user,
            data: { ip: meta.ip },
        });
    }

    return { success: true };
}
