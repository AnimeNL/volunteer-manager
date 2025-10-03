// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Skeleton from '@mui/material/Skeleton';

/**
 * The <AnimeConStreamingApiPlaceholder> component displays a pageholder paper that will be replaced
 * with the actual result contents.
 */
export function AnimeConStreamingApiPlaceholder() {
    return (
        <>
            <Skeleton height={8} width="90%" />
            <Skeleton height={8} width="85%" />
            <Skeleton height={8} width="88%" />
        </>
    );
}
