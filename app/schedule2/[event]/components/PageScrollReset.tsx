// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import Box from '@mui/material/Box';

/**
 * Resets the scroll position of its enclosing scroll container whenever the active pathname
 * changes. Required on mobile where `<Page>` renders an inner `overflow-y: auto` sheet that
 * Next.js reuses across sibling dynamic routes (e.g. `/vendors/first-aid` to `/vendors/security`).
 */
export function PageScrollReset() {
    const markerRef = useRef<HTMLSpanElement>(null);
    const pathname = usePathname();
    const previousPathnameRef = useRef<string>(pathname);

    useEffect(() => {
        if (previousPathnameRef.current === pathname)
            return;

        previousPathnameRef.current = pathname;

        const container = markerRef.current?.parentElement;
        if (container && container.scrollTop > 0)
            container.scrollTop = 0;
    }, [ pathname ]);

    return <Box component="span" aria-hidden="true" ref={markerRef} sx={{ display: 'none' }} />;
}
