// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

/**
 * Catch-all route that delegates any unmatched URL under `/schedule2/[event]/*` to the segment's
 * local `not-found.tsx` boundary rather than falling through to the global root `not-found.tsx`.
 */
export default function Schedule2CatchAllNotFoundPage() {
    notFound();
}

export const instant = true;
export const prefetch = 'partial';
