// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { notFound } from 'next/navigation';

import type { NextRouteParams } from '@lib/NextRouterParams';
import { readBlobDataByHash } from '@lib/database/BlobStore';

/**
 * The /blob/ endpoint exposes access to blob based on their file hashes.
 */
export async function GET(request: NextRequest, props: NextRouteParams<never, 'hash'>)
    : Promise<Response>
{
    const params = await props.params;

    if (Array.isArray(params.hash) && params.hash.length && params.hash[0].endsWith('.png')) {
        const hash = params.hash[0].substring(0, params.hash[0].length - 4);

        const data = await readBlobDataByHash(hash);
        if (data) {
            return new Response(data.bytes as BodyInit, {
                headers: [
                    [ 'Cache-Control', 'max-age=31536000'],
                    [ 'Cache-Control', 'max-age=31536000, immutable'],
                    [ 'Content-Type', data.mimeType ],
                    [ 'Pragma', 'public' ],
                ],
            });
        }
    }

    notFound();
}
