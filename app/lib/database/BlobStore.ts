// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { v4 as uuid } from 'uuid';

import db, { tStorage } from './index';
import { FileType } from './Types';

/**
 * Returns the blob Url for the given |hash|. Will return `undefined` when no hash is available.
 */
export function getBlobUrl(hash?: string): string | undefined {
    return hash ? `/blob/${hash}.png`
                : undefined;
}

/**
 * Mimics (synchronous) NanoID behaviour using the UUID library. Returns a string of random numbers
 * and letters of the given `length`.
 *
 * @see https://github.com/ai/nanoid/issues/365
 * @todo Switch back to `nanoid` when we can depend on it w/o breaking tests, which have issues
 *       between Jest and ESM modules.
 */
const nanoid = (length: number) => uuid().replaceAll('-', '').slice(0, length);

/**
 * What is the size limit for blobs we're willing to store in the database?
 */
const kBlobSizeLimit = 5 * 1024 * 1024;  // 5MB

/**
 * Reads the blob associated with the given `hash` from the database. Hashes are used many other
 * identifiers are sequential, and we don't want to accidentally leak information.
 */
export async function readBlobDataByHash(hash: string)
    : Promise<{ bytes: Uint8Array, mimeType: string } | undefined>
{
    const bucket = await db.selectFrom(tStorage)
        .select({
            bytes: tStorage.fileData,
            mimeType: tStorage.fileMimeType,
        })
        .where(tStorage.fileHash.equals(hash))
        .executeSelectNoneOrOne();

    return bucket ?? undefined;
}

/**
 * Parameters required when storing blobs in the database.
 */
export interface BlobInfo {
    /**
     * The bytes that should be stored in the database.
     */
    bytes: Buffer;

    /**
     * Mime type of the information that's being stored. (E.g. "image/png")
     */
    mimeType: string;

    /**
     * Type of data that's being stored, for categorisation purposes.
     */
    type: FileType;

    /**
     * Unique ID of the user with whom this data should be associated.
     */
    userId?: number;
}

/**
 * Stores the blob represented by the given `data` in the database, optionally associated with the
 * given `user` to whom the data belongs. Returns the file ID when successful.
 */
export async function storeBlobData(info: BlobInfo): Promise<number | false> {
    if (info.bytes.length > kBlobSizeLimit) {
        console.error('Unable to store an blob: request too large');
        return false;
    }

    const hash = nanoid(/* size= */ 12);
    const insertId = await db.insertInto(tStorage)
        .values({
            fileHash: hash,
            fileType: info.type,
            fileMimeType: info.mimeType,
            fileDate: db.currentDateTime2(),
            fileData: info.bytes,
            userId: info.userId,
        })
        .returningLastInsertedId()
        .executeInsert();

    if (!insertId)
        console.error('Unable to storage an blob');

    return insertId;
}
