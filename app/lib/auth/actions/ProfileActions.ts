// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { RecordLog, kLogType } from '@lib/Log';
import { checkRateLimit } from '../RateLimit';
import { formatDate } from '@lib/Temporal';
import { getAuthRequestMetadata, parseBirthdate } from './ActionHelpers';
import { invalidateAuthCache, requireAuthenticationContext } from '../AuthenticationContext';
import { storeBlobData } from '@lib/database/BlobStore';
import db, { tUsers } from '@lib/database';

import { kAuthRateLimits } from '../RateLimit';
import { kCommunicationLanguage, kFileType } from '@lib/database/Types';

/**
 * Maximum permitted avatar upload size (5 MiB).
 */
const kMaxAvatarBytes = 5 * 1024 * 1024;

/**
 * Standard 8-byte PNG file signature.
 */
const kPngSignature = [ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ] as const;

const kUpdateOwnAccountInput = z.object({
    firstName: z.string().max(128),
    lastName: z.string().max(128),
    gender: z.string().max(64),
    birthdate: z.string().optional(),
    phoneNumber: z.string().max(64).optional(),
    discordHandle: z.string().max(64).optional(),
    language: z.enum(kCommunicationLanguage).optional(),
});

/**
 * Editable profile fields accepted by `updateOwnAccountAction()`.
 */
type UpdateOwnAccountInput = z.infer<typeof kUpdateOwnAccountInput>;

/**
 * Profile fields returned by `getOwnAccountAction()`.
 */
interface OwnAccountProfile extends UpdateOwnAccountInput {
    username?: string;
}

/**
 * Result returned by `getOwnAccountAction()`.
 */
interface GetOwnAccountResult {
    success: boolean;
    error?: string;
    account?: OwnAccountProfile;
}

/**
 * Result returned by `updateOwnAccountAction()` and `updateAvatarAction()`.
 */
interface ProfileMutationResult {
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
    input: UpdateOwnAccountInput): Promise<ProfileMutationResult>
{
    const { user } = await requireAuthenticationContext();
    const parsed = kUpdateOwnAccountInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Please check the account information you entered.' };

    const update = parsed.data;
    if (!update.firstName.trim().length)
        return { success: false, error: 'You need to fill in your first name.' };
    if (!update.lastName.trim().length)
        return { success: false, error: 'You need to fill in your last name.' };
    if (!update.gender.trim().length)
        return { success: false, error: 'You need to fill in your gender.' };
    const birthdate = parseBirthdate(update.birthdate);
    if (!birthdate)
        return { success: false, error: 'You need to fill in your date of birth.' };
    const phoneNumber = update.phoneNumber?.trim();
    if (!phoneNumber || phoneNumber.length < 8)
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
            birthdate,
            phoneNumber,
            discordHandle: normalizedDiscord,
            discordHandleUpdated,
        })
        .where(tUsers.userId.equals(user.id))
        .executeUpdate();

    invalidateAuthCache(/* forUserId= */ user.id);

    const meta = await getAuthRequestMetadata();
    RecordLog({
        type: kLogType.AccountUpdate,
        sourceUser: user,
        data: { ip: meta.ip, ...existing },
    });

    return { success: true };
}

/**
 * Resolves and authorizes the target user ID for an avatar upload, returning an error string when
 * `overrideUserId` is malformed.
 */
async function resolveAvatarSubject(
    context: Awaited<ReturnType<typeof requireAuthenticationContext>>,
    overrideEntry: FormDataEntryValue | null)
    : Promise<{ subjectUserId: number; isOverride: boolean } | { error: string }>
{
    if (overrideEntry === null || !String(overrideEntry).length)
        return { subjectUserId: context.user.id, isOverride: false };

    const overrideUserId = Number(overrideEntry);
    if (!Number.isInteger(overrideUserId) || overrideUserId <= 0)
        return { error: 'Invalid user identifier.' };

    if (overrideUserId === context.user.id)
        return { subjectUserId: context.user.id, isOverride: false };

    await requireAuthenticationContext('organisation.avatars', undefined, { bypassCache: true });
    return { subjectUserId: overrideUserId, isOverride: true };
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

    const subject = await resolveAvatarSubject(context, formData.get('overrideUserId'));
    if ('error' in subject)
        return { success: false, error: subject.error };

    const uploadLimit = checkRateLimit(
        'avatar-upload-user', String(context.user.id), kAuthRateLimits.avatarUploadByUser);
    if (!uploadLimit.allowed)
        return { success: false, error: 'Too many avatar uploads. Please try again later.' };

    const bytes = new Uint8Array(await avatarEntry.arrayBuffer());
    if (!hasPngSignature(bytes))
        return { success: false, error: 'Avatar uploads must be in PNG format.' };

    if (subject.isOverride) {
        const targetUserId = await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(subject.subjectUserId))
                .and(tUsers.anonymized.isNull())
            .selectOneColumn(tUsers.userId)
            .executeSelectNoneOrOne();

        if (!targetUserId)
            return { success: false, error: 'The target account could not be found.' };
    }

    const avatarId = await storeBlobData({
        bytes,
        mimeType: 'image/png',
        type: kFileType.Avatar,
        userId: subject.subjectUserId,
    });

    if (!avatarId)
        return { success: false };

    const affectedRows = await db.update(tUsers)
        .set({ avatarId })
        .where(tUsers.userId.equals(subject.subjectUserId))
            .and(tUsers.anonymized.isNull())
        .executeUpdate();

    if (!affectedRows)
        return { success: false };

    invalidateAuthCache(/* forUserId= */ subject.subjectUserId);

    if (subject.isOverride) {
        LogBuilder.for('AdminUpdateAvatar')
            .withInitiatorUser(context.user)
            .withAffectedUser(subject.subjectUserId)
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
