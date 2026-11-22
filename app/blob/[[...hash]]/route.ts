// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { notFound } from 'next/navigation';

import { Cache } from '@lib/cache';
import { readBlobDataByHash } from '@lib/database/BlobStore';

/**
 * The /blob/ endpoint exposes access to blob based on their file hashes.
 */
export async function GET(request: NextRequest, context: RouteContext<'/blob/[[...hash]]'>) {
    const params = await context.params;

    if (Array.isArray(params.hash) && params.hash.length && params.hash[0].endsWith('.png')) {
        const hash = params.hash[0].substring(0, params.hash[0].length - 4);

        const data = await Cache.getInstance('Blob').getOrInsert(hash, async () => {
            const dbResult = await readBlobDataByHash(hash);
            return dbResult ?? null;
        });

        if (data) {
            const cacheControl = 'public, max-age=31536000, immutable';
            const etag = `"${hash}"`;

            const ifNoneMatch = request.headers.get('if-none-match');
            const matchesETag = !!ifNoneMatch && (
                ifNoneMatch === '*' ||
                ifNoneMatch.split(',').some(tag => tag.trim().replace(/^W\//, '') === etag));

            if (matchesETag) {
                return new Response(null, {
                    status: 304,
                    headers: [
                        [ 'Cache-Control', cacheControl ],
                        [ 'ETag', etag ],
                    ],
                });
            }

            return new Response(data.bytes, {
                headers: [
                    [ 'Cache-Control', cacheControl ],
                    [ 'Content-Type', data.mimeType ],
                    [ 'ETag', etag ],
                    [ 'X-Content-Type-Options', 'nosniff' ],
                ],
            });
        }
    }

    notFound();
}
